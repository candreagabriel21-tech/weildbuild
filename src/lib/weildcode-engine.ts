// ═══════════════════════════════════════════════════════════════════
// WeildCode Runtime Engine — Executes rules during Play/Test mode
// ═══════════════════════════════════════════════════════════════════
//
// This engine runs ONLY when playState.isPlaying or simulationState.isSimulating
// is true. It processes triggers and executes actions on the store.

import {
  WeildCodeRule,
  WeildCodeAction,
  TriggerType,
  ActionType,
  TRIGGER_DEFINITIONS,
  ACTION_DEFINITIONS,
  createBlankRule,
  createBlankAction,
} from './weildcode-types';
import { useStudioStore, isPart, StudioPart, Vector3, PartType } from './studio-store';

// ─── Engine State ───

interface TimerState {
  ruleId: string;
  partId: string;
  intervalSeconds: number;
  repeat: 'once' | 'every';
  elapsed: number;
  fired: boolean; // for 'once' mode
  maxRepeats: number; // for repeat_every (0 = infinity)
  fireCount: number;
}

interface PendingWait {
  ruleId: string;
  partId: string;
  actionIndex: number;
  remainingSeconds: number;
}

class WeildCodeEngine {
  private timers: Map<string, TimerState> = new Map();
  private pendingWaits: Map<string, PendingWait> = new Map();
  private lastTime: number = 0;
  private animFrameId: number | null = null;
  private isRunning: boolean = false;

  // Track which parts have already fired their when_created trigger
  private createdParts: Set<string> = new Set();

  // Track previous weather/time for change detection
  private lastWeather: string = '';
  private lastTimeOfDay: number = -1;

  // Track global variable snapshots for when_variable_equals / when_variable_changes
  private variableSnapshots: Map<string, number | string | boolean> = new Map();
  private variableCheckAccumulators: Map<string, number> = new Map(); // key -> accumulated time since last check
  // Per-part object variable snapshots: partId -> (varName -> last seen value).
  // Used to detect changes for when_variable_changes with scope="object".
  private objectVariableSnapshots: Map<string, Map<string, number | string>> = new Map();

  // Track condition check accumulators for when_condition / when_coinflip
  private conditionCheckAccumulators: Map<string, number> = new Map();
  private coinFlipFired: Set<string> = new Set(); // one-shot coinflip rules that already fired

  // Track floating name labels (partId -> { text, startTime, duration })
  private nameLabels: Map<string, { text: string; color: string; fontSize: number; startTime: number; duration: number }> = new Map();

  // ─── Start / Stop ───

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.createdParts.clear();
    this.timers.clear();
    this.pendingWaits.clear();
    this.lastWeather = useStudioStore.getState().worldSettings.weatherType;
    this.lastTimeOfDay = useStudioStore.getState().worldSettings.timeOfDay;
    this.variableSnapshots.clear();
    this.variableCheckAccumulators.clear();
    this.objectVariableSnapshots.clear();
    this.conditionCheckAccumulators.clear();
    this.coinFlipFired.clear();
    this.nameLabels.clear();

    // Snapshot current global variables
    const vars = useStudioStore.getState().globalVariables;
    for (const [name, value] of Object.entries(vars)) {
      this.variableSnapshots.set(name, value);
    }

    // Snapshot current per-object variables
    useStudioStore.getState().objects.forEach((obj) => {
      if (!isPart(obj) || !obj.objectVariables) return;
      const snap = new Map<string, number | string>();
      for (const [name, value] of Object.entries(obj.objectVariables)) {
        snap.set(name, value);
      }
      this.objectVariableSnapshots.set(obj.id, snap);
    });

    // Fire when_created for all existing parts
    const state = useStudioStore.getState();
    state.objects.forEach((obj) => {
      if (isPart(obj)) {
        this.fireTrigger(obj.id, 'when_created');
        this.createdParts.add(obj.id);
      }
    });

    // Start the update loop
    this.update();
  }

  stop() {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.timers.clear();
    this.pendingWaits.clear();
    this.createdParts.clear();
    // Clear any on-screen messages
    useStudioStore.getState().clearScreenMessages();
  }

  // ─── Main Update Loop ───

  private update = () => {
    if (!this.isRunning) return;

    const now = performance.now();
    const dt = (now - this.lastTime) / 1000; // delta in seconds
    this.lastTime = now;

    const state = useStudioStore.getState();

    // Check for newly created parts (when_created trigger)
    state.objects.forEach((obj) => {
      if (isPart(obj) && !this.createdParts.has(obj.id)) {
        this.fireTrigger(obj.id, 'when_created');
        this.createdParts.add(obj.id);
      }
    });

    // Check weather changes
    const currentWeather = state.worldSettings.weatherType;
    if (currentWeather !== this.lastWeather) {
      this.lastWeather = currentWeather;
      // Fire when_weather_is for all parts with matching rules
      state.objects.forEach((obj) => {
        if (isPart(obj)) {
          this.fireTrigger(obj.id, 'when_weather_is');
        }
      });
    }

    // Check time changes
    const currentTime = state.worldSettings.timeOfDay;
    if (currentTime !== this.lastTimeOfDay) {
      this.lastTimeOfDay = currentTime;
      // Fire when_time_is for all parts
      state.objects.forEach((obj) => {
        if (isPart(obj)) {
          this.fireTrigger(obj.id, 'when_time_is');
        }
      });
    }

    // Update timers
    this.updateTimers(dt);

    // Update pending waits
    this.updateWaits(dt);

    // Poll variable triggers and condition triggers
    this.updateVariableTriggers(dt, state);

    // Poll condition triggers (when_condition, when_coinflip)
    this.updateConditionTriggers(dt, state);

    // Remove expired screen messages
    this.updateScreenMessages();

    // Update floating name labels
    this.updateNameLabels();

    this.animFrameId = requestAnimationFrame(this.update);
  };

  // ─── Trigger Firing ───

  fireTrigger(partId: string, triggerType: TriggerType, eventData?: Record<string, any>) {
    const state = useStudioStore.getState();
    const obj = state.objects.get(partId);
    if (!obj || !isPart(obj)) return;

    const rules = obj.rules || [];
    for (const rule of rules) {
      if (!rule.enabled) continue;
      if (rule.trigger.type !== triggerType) continue;

      // Check trigger-specific conditions
      if (!this.checkTriggerConditions(rule, triggerType, eventData, obj)) continue;

      // Execute the rule's actions
      this.executeActions(partId, rule.actions, rule.id);
    }
  }

  private checkTriggerConditions(
    rule: WeildCodeRule,
    triggerType: TriggerType,
    eventData?: Record<string, any>,
    part?: StudioPart,
  ): boolean {
    const params = rule.trigger.params;

    switch (triggerType) {
      case 'when_touched': {
        const filter = params.filter || 'any';
        if (filter === 'player' && eventData?.touchType !== 'player') return false;
        if (filter === 'parts' && eventData?.touchType !== 'parts') return false;
        return true;
      }
      case 'on_timer': {
        // Timer triggers are handled separately by updateTimers
        // This path is for initial setup
        this.setupTimer(rule, part?.id || '');
        return false; // Don't fire immediately
      }
      case 'on_property_change': {
        const property = params.property || 'any';
        if (property !== 'any' && eventData?.property !== property) return false;
        return true;
      }
      case 'when_time_is': {
        const timeMode = params.timeMode || 'exact';
        const state = useStudioStore.getState();
        const timeOfDay = state.worldSettings.timeOfDay;

        if (timeMode === 'exact') {
          const target = params.timeValue || '12:00';
          const [h, m] = target.split(':').map(Number);
          const targetHours = h + m / 60;
          // Check if current time is within 0.5 hours of target
          return Math.abs(timeOfDay - targetHours) < 0.5;
        } else {
          // Period-based
          const period = params.period || 'noon';
          return this.isTimeInPeriod(timeOfDay, period);
        }
      }
      case 'when_weather_is': {
        const state = useStudioStore.getState();
        return state.worldSettings.weatherType === (params.weatherType || 'rain');
      }
      default:
        return true;
    }
  }

  private isTimeInPeriod(time: number, period: string): boolean {
    switch (period) {
      case 'dawn': return time >= 5 && time < 7;
      case 'morning': return time >= 7 && time < 11;
      case 'noon': return time >= 11 && time < 13;
      case 'afternoon': return time >= 13 && time < 17;
      case 'dusk': return time >= 17 && time < 19;
      case 'evening': return time >= 19 && time < 22;
      case 'midnight': return time >= 22 || time < 5;
      default: return false;
    }
  }

  // ─── Timer Management ───

  private setupTimer(rule: WeildCodeRule, partId: string) {
    const key = `${partId}_${rule.id}`;
    if (this.timers.has(key)) return;

    const intervalSeconds = rule.trigger.params.intervalSeconds || 1;
    const repeat = rule.trigger.params.repeat || 'every';

    this.timers.set(key, {
      ruleId: rule.id,
      partId,
      intervalSeconds,
      repeat: repeat as 'once' | 'every',
      elapsed: 0,
      fired: false,
      maxRepeats: 0,
      fireCount: 0,
    });
  }

  private updateTimers(dt: number) {
    const state = useStudioStore.getState();

    for (const [key, timer] of this.timers.entries()) {
      // Skip if part no longer exists
      if (!state.objects.has(timer.partId)) {
        this.timers.delete(key);
        continue;
      }

      timer.elapsed += dt;

      if (timer.elapsed >= timer.intervalSeconds) {
        timer.elapsed -= timer.intervalSeconds;

        if (timer.repeat === 'once' && timer.fired) continue;

        // Fire the timer
        const obj = state.objects.get(timer.partId);
        if (obj && isPart(obj)) {
          const rule = (obj.rules || []).find((r) => r.id === timer.ruleId);
          if (rule && rule.enabled) {
            this.executeActions(timer.partId, rule.actions, rule.id);
          }
        }

        timer.fired = true;
        timer.fireCount++;

        if (timer.repeat === 'once') {
          this.timers.delete(key);
        }

        // Check maxRepeats for repeat_every actions (handled at action level, not trigger level)
      }
    }
  }

  // ─── Wait Management ───

  private updateWaits(dt: number) {
    for (const [key, wait] of this.pendingWaits.entries()) {
      wait.remainingSeconds -= dt;
      if (wait.remainingSeconds <= 0) {
        this.pendingWaits.delete(key);
        // Continue executing from the next action after the wait
        const state = useStudioStore.getState();
        const obj = state.objects.get(wait.partId);
        if (obj && isPart(obj)) {
          const rule = (obj.rules || []).find((r) => r.id === wait.ruleId);
          if (rule && rule.enabled) {
            // Execute remaining actions after the wait
            const remainingActions = rule.actions.slice(wait.actionIndex + 1);
            this.executeActions(wait.partId, remainingActions, rule.id);
          }
        }
      }
    }
  }

  // ─── Screen Message Expiry ───

  private updateScreenMessages() {
    const state = useStudioStore.getState();
    const now = performance.now();
    const expired = state.screenMessages.filter(
      (m) => (now - m.startTime) / 1000 >= m.duration
    );
    for (const m of expired) {
      state.removeScreenMessage(m.id);
    }
  }

  // ─── Action Execution ───

  private executeActions(partId: string, actions: WeildCodeAction[], ruleId: string, depth = 0) {
    if (depth > 10) return; // Prevent infinite recursion

    const state = useStudioStore.getState();
    const part = state.objects.get(partId);
    if (!part || !isPart(part)) return;

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      if (!action.enabled) continue;

      // Handle wait — pause execution and resume later
      if (action.type === 'wait') {
        const seconds = action.params.seconds || 1;
        const waitKey = `${partId}_${ruleId}_${i}`;
        this.pendingWaits.set(waitKey, {
          ruleId,
          partId,
          actionIndex: i,
          remainingSeconds: seconds,
        });
        return; // Stop executing further actions; will resume after wait
      }

      this.executeAction(partId, action, ruleId, depth);
    }
  }

  private executeAction(partId: string, action: WeildCodeAction, ruleId: string, depth: number) {
    const state = useStudioStore.getState();
    const part = state.objects.get(partId);
    if (!part || !isPart(part)) return;

    switch (action.type) {
      case 'create_part': {
        this.executeCreatePart(partId, action);
        break;
      }
      case 'delete_part': {
        this.executeDeletePart(partId, action);
        break;
      }
      case 'move': {
        this.executeMove(partId, action);
        break;
      }
      case 'rotate': {
        this.executeRotate(partId, action);
        break;
      }
      case 'resize': {
        this.executeResize(partId, action);
        break;
      }
      case 'change_color': {
        useStudioStore.getState().updateObject(partId, { color: action.params.color || '#ff0000' });
        break;
      }
      case 'change_material': {
        useStudioStore.getState().updateObject(partId, { material: action.params.material || 'Plastic' });
        break;
      }
      case 'change_transparency': {
        useStudioStore.getState().updateObject(partId, { transparency: action.params.transparency ?? 0.5 });
        break;
      }
      case 'apply_force': {
        // Apply force via BodyMover (BodyForce)
        const force = action.params.force || { x: 0, y: 50, z: 0 };
        useStudioStore.getState().addBodyMover(partId, {
          id: `bm_wc_${Date.now()}`,
          type: 'BodyForce',
          enabled: true,
          force: { x: force.x, y: force.y, z: force.z },
        });
        break;
      }
      case 'apply_explosion': {
        const radius = action.params.radius || 8;
        const pressure = action.params.pressure || 500000;
        useStudioStore.getState().createExplosion(
          { ...part.position },
          radius,
          pressure,
        );
        break;
      }
      case 'play_sound': {
        // Visual-only feedback in console (no actual audio yet)
        const sound = action.params.sound || 'click';
        useStudioStore.getState().addConsoleMessage('info', `[WeildCode] Sound: ${sound}`);
        break;
      }
      case 'visual_effect': {
        const effectType = action.params.effectType || 'Fire';
        const color = action.params.color || '#ff6600';
        const size = action.params.size || 3;
        useStudioStore.getState().addEffect(partId, {
          id: `fx_wc_${Date.now()}`,
          type: effectType as 'Fire' | 'Smoke' | 'Light',
          color,
          size,
          enabled: true,
          brightness: effectType === 'Light' ? 2 : undefined,
          range: effectType === 'Light' ? size * 3 : undefined,
          opacity: effectType === 'Smoke' ? 0.5 : undefined,
        });
        break;
      }
      case 'repeat': {
        const count = action.params.count || 3;
        const delayBetween = action.params.delayBetween || 0;
        if (action.children && action.children.length > 0) {
          for (let i = 0; i < count; i++) {
            if (delayBetween > 0 && i > 0) {
              // Simple delay approximation (not async — immediate for now)
              // In a full implementation, we'd schedule these
            }
            this.executeActions(partId, action.children, ruleId, depth + 1);
          }
        }
        break;
      }
      case 'repeat_every': {
        const intervalSeconds = action.params.intervalSeconds || 2;
        const maxRepeats = action.params.maxRepeats || 0;
        // Set up a timer-like recurring execution
        // For simplicity, we execute immediately and set up a timer for repeats
        if (action.children && action.children.length > 0) {
          this.executeActions(partId, action.children, ruleId, depth + 1);
        }
        // Set up recurring timer
        const timerKey = `repeat_${partId}_${action.id}`;
        this.timers.set(timerKey, {
          ruleId,
          partId,
          intervalSeconds,
          repeat: 'every',
          elapsed: 0,
          fired: true, // Already fired once
          maxRepeats,
          fireCount: 1,
        });
        break;
      }
      case 'tell_object': {
        const targetName = action.params.targetName || '';
        if (!targetName) break;

        // Find the target object by name
        const state = useStudioStore.getState();
        let targetPart: StudioPart | null = null;
        state.objects.forEach((obj) => {
          if (isPart(obj) && obj.name === targetName) {
            targetPart = obj;
          }
        });

        if (targetPart && action.children && action.children.length > 0) {
          this.executeActions((targetPart as StudioPart).id, action.children, ruleId, depth + 1);
        } else if (!targetPart) {
          useStudioStore.getState().addConsoleMessage('warn', `[WeildCode] Object "${targetName}" not found`);
        }
        break;
      }
      case 'print_message': {
        const message = action.params.message || 'Hello, world!';
        const position = action.params.position || 'bottom';
        const textColor = action.params.textColor || '#ffffff';
        const fontStyle = action.params.fontStyle || 'normal';
        const fontSize = action.params.fontSize || 24;
        const backgroundColor = action.params.backgroundColor || '#000000';
        const duration = action.params.duration ?? 3;
        useStudioStore.getState().addScreenMessage({
          message,
          position: position as 'top' | 'bottom',
          textColor,
          fontStyle: fontStyle as 'normal' | 'bold' | 'italic' | 'bold-italic',
          fontSize,
          backgroundColor,
          duration,
        });
        useStudioStore.getState().addConsoleMessage('info', `[WeildCode] Print: "${message}"`);
        break;
      }
      case 'remove_from_workspace': {
        // Permanent removal — same as delete but with different semantic
        this.executeRemoveFromWorkspace(partId, action);
        break;
      }
      case 'show_name': {
        const rawText = action.params.text || 'Hello';
        const text = rawText.substring(0, 12); // max 12 chars
        const color = action.params.color || '#ffffff';
        const fontSize = action.params.fontSize || 16;
        const duration = action.params.duration ?? 5;
        this.nameLabels.set(partId, {
          text,
          color,
          fontSize,
          startTime: performance.now(),
          duration,
        });
        useStudioStore.getState().addConsoleMessage('info', `[WeildCode] Showing name "${text}" above ${part.name}`);
        break;
      }
      case 'create_copy': {
        this.executeCreateCopy(partId, action);
        break;
      }
      case 'add_rule': {
        this.executeAddRule(partId, action);
        break;
      }
      case 'set_variable': {
        const varName = action.params.variableName || '';
        if (!varName) break;
        const rawValue = action.params.value ?? '0';
        const numVal = Number(rawValue);
        const value = !isNaN(numVal) && String(rawValue).trim() !== '' ? numVal : rawValue;
        const scope = action.params.scope || 'global';
        if (scope === 'object') {
          // Per-object variable — only this part can read/write it.
          useStudioStore.getState().setObjectVariable(partId, varName, value as number | string);
          useStudioStore.getState().addConsoleMessage('info', `[WeildCode] Set object variable "${varName}" = ${value} (on part ${partId})`);
        } else {
          useStudioStore.getState().setGlobalVariable(varName, value);
          useStudioStore.getState().addConsoleMessage('info', `[WeildCode] Set variable "${varName}" = ${value}`);
        }
        break;
      }
      case 'change_variable': {
        this.executeChangeVariable(partId, action);
        break;
      }
      case 'send_to_universe': {
        const universeId = action.params.universeId || 'place_default';
        useStudioStore.getState().switchUniverse(universeId);
        useStudioStore.getState().addConsoleMessage('info', `[WeildCode] Sent player to universe: ${universeId}`);
        break;
      }
    }
  }

  // ─── Specific Action Implementations ───

  private executeCreatePart(sourcePartId: string, action: WeildCodeAction) {
    const state = useStudioStore.getState();
    const partType = (action.params.partType || 'Block') as PartType;
    const partName = action.params.partName || 'NewPart';
    const position = action.params.position || { x: 0, y: 1, z: 0 };
    const color = action.params.color || '#4ff7f5';

    // If source part exists, offset relative to it
    const sourcePart = state.objects.get(sourcePartId);
    const finalPos = sourcePart && isPart(sourcePart)
      ? {
          x: sourcePart.position.x + (position.x || 0),
          y: sourcePart.position.y + (position.y || 0),
          z: sourcePart.position.z + (position.z || 0),
        }
      : position;

    // Create the part using the store's addPart
    // We need to bypass addPart since it uses its own naming
    const id = `obj_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const partDefaults: Record<string, { color: string; size: Vector3 }> = {
      Block: { color: '#4ff7f5', size: { x: 1, y: 1, z: 1 } },
      Sphere: { color: '#f24b4b', size: { x: 1, y: 1, z: 1 } },
      Wedge: { color: '#f7f54f', size: { x: 1, y: 1, z: 1 } },
      Cylinder: { color: '#37e62e', size: { x: 1, y: 1, z: 1 } },
    };
    const defaults = partDefaults[partType] || partDefaults['Block'];

    const newPart: StudioPart = {
      id,
      name: partName,
      type: partType,
      position: finalPos,
      size: { ...defaults.size },
      rotation: { x: 0, y: 0, z: 0 },
      color: color || defaults.color,
      material: 'Plastic',
      transparency: 0,
      reflectance: 0,
      anchored: true,
      canCollide: true,
      friction: 0.5,
      elasticity: 0.2,
      density: 1.0,
      children: [],
      parentId: null,
      bodyMovers: [],
      effects: [],
    };

    const newObjects = new Map(state.objects);
    newObjects.set(id, newPart);
    useStudioStore.getState().addObject(newPart);
    state.addConsoleMessage('info', `[WeildCode] Created ${partType}: ${partName}`);
  }

  private executeDeletePart(sourcePartId: string, action: WeildCodeAction) {
    const target = action.params.target || 'self';
    const targetName = action.params.targetName || '';

    if (target === 'self') {
      useStudioStore.getState().removeObject(sourcePartId);
    } else if (targetName) {
      // Find by name
      const state = useStudioStore.getState();
      state.objects.forEach((obj) => {
        if (isPart(obj) && obj.name === targetName) {
          useStudioStore.getState().removeObject(obj.id);
        }
      });
    }
  }

  private executeMove(partId: string, action: WeildCodeAction) {
    const mode = action.params.mode || 'offset';
    const position = action.params.position || { x: 0, y: 1, z: 0 };

    const state = useStudioStore.getState();
    const part = state.objects.get(partId);
    if (!part || !isPart(part)) return;

    if (mode === 'absolute') {
      useStudioStore.getState().updateObject(partId, { position: { ...position } });
    } else {
      // Offset from current position
      useStudioStore.getState().updateObject(partId, {
        position: {
          x: part.position.x + position.x,
          y: part.position.y + position.y,
          z: part.position.z + position.z,
        },
      });
    }
  }

  private executeRotate(partId: string, action: WeildCodeAction) {
    const rotation = action.params.rotation || { x: 0, y: 90, z: 0 };

    const state = useStudioStore.getState();
    const part = state.objects.get(partId);
    if (!part || !isPart(part)) return;

    useStudioStore.getState().updateObject(partId, {
      rotation: {
        x: part.rotation.x + rotation.x,
        y: part.rotation.y + rotation.y,
        z: part.rotation.z + rotation.z,
      },
    });
  }

  private executeResize(partId: string, action: WeildCodeAction) {
    const mode = action.params.mode || 'offset';
    const size = action.params.size || { x: 1, y: 1, z: 1 };

    const state = useStudioStore.getState();
    const part = state.objects.get(partId);
    if (!part || !isPart(part)) return;

    if (mode === 'absolute') {
      useStudioStore.getState().updateObject(partId, { size: { ...size } });
    } else if (mode === 'offset') {
      useStudioStore.getState().updateObject(partId, {
        size: {
          x: Math.max(0.1, part.size.x + size.x),
          y: Math.max(0.1, part.size.y + size.y),
          z: Math.max(0.1, part.size.z + size.z),
        },
      });
    } else if (mode === 'multiply') {
      useStudioStore.getState().updateObject(partId, {
        size: {
          x: Math.max(0.1, part.size.x * size.x),
          y: Math.max(0.1, part.size.y * size.y),
          z: Math.max(0.1, part.size.z * size.z),
        },
      });
    }
  }

  private executeRemoveFromWorkspace(partId: string, action: WeildCodeAction) {
    const target = action.params.target || 'self';
    const targetName = action.params.targetName || '';

    if (target === 'self') {
      useStudioStore.getState().removeObject(partId);
      useStudioStore.getState().addConsoleMessage('info', `[WeildCode] Removed part from workspace`);
    } else if (targetName) {
      const state = useStudioStore.getState();
      state.objects.forEach((obj) => {
        if (isPart(obj) && obj.name === targetName) {
          useStudioStore.getState().removeObject(obj.id);
        }
      });
    }
  }

  private executeCreateCopy(sourcePartId: string, action: WeildCodeAction) {
    const state = useStudioStore.getState();
    const target = action.params.target || 'self';
    const targetName = action.params.targetName || '';
    const copyName = action.params.copyName || '';
    const count = Math.min(action.params.count || 1, 20); // cap at 20 copies
    const offset = action.params.offset || { x: 2, y: 0, z: 0 };

    // Find the source part
    let sourcePart: StudioPart | null = null;
    if (target === 'self') {
      const obj = state.objects.get(sourcePartId);
      if (obj && isPart(obj)) sourcePart = obj;
    } else if (targetName) {
      state.objects.forEach((obj) => {
        if (isPart(obj) && obj.name === targetName) sourcePart = obj;
      });
    }

    if (!sourcePart) {
      state.addConsoleMessage('warn', `[WeildCode] create_copy: source part not found`);
      return;
    }

    for (let i = 0; i < count; i++) {
      const id = `obj_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const newPart: StudioPart = {
        ...JSON.parse(JSON.stringify(sourcePart)),
        id,
        name: copyName || `${sourcePart.name}_copy`,
        position: {
          x: sourcePart.position.x + offset.x * (i + 1),
          y: sourcePart.position.y + offset.y * (i + 1),
          z: sourcePart.position.z + offset.z * (i + 1),
        },
        parentId: null,
        children: [],
        bodyMovers: [],
        effects: [],
        rules: [],
      };
      useStudioStore.getState().addObject(newPart);
    }
    state.addConsoleMessage('info', `[WeildCode] Created ${count} copy(ies) of ${sourcePart.name}`);
  }

  private executeAddRule(partId: string, action: WeildCodeAction) {
    const state = useStudioStore.getState();
    const target = action.params.target || 'self';
    const targetName = action.params.targetName || '';
    const triggerType = action.params.triggerType || 'when_clicked';
    const actionType = action.params.actionType || 'print_message';

    // Find the target part
    let targetPartId = partId;
    if (target === 'named' && targetName) {
      let found = false;
      state.objects.forEach((obj) => {
        if (isPart(obj) && obj.name === targetName && !found) {
          targetPartId = obj.id;
          found = true;
        }
      });
      if (!found) {
        state.addConsoleMessage('warn', `[WeildCode] add_rule: target "${targetName}" not found`);
        return;
      }
    }

    // Use the imported createBlankRule and createBlankAction
    const rule = createBlankRule('simple');
    rule.trigger.type = triggerType as any;
    rule.trigger.params = {};
    rule.actions = [createBlankAction(actionType as any)];

    useStudioStore.getState().addRule(targetPartId, rule);
    state.addConsoleMessage('info', `[WeildCode] Added rule (${triggerType} → ${actionType}) to ${targetPartId === partId ? 'self' : targetName}`);
  }

  private executeChangeVariable(partId: string, action: WeildCodeAction) {
    const varName = action.params.variableName || '';
    if (!varName) return;

    const state = useStudioStore.getState();
    const scope = action.params.scope || 'global';
    const part = state.objects.get(partId);
    // Current value: from per-object vars if scope=object, else from globals.
    const currentValue = scope === 'object'
      ? (part && isPart(part) ? part.objectVariables?.[varName] : undefined)
      : state.globalVariables[varName];
    const expression = String(action.params.expression || 'variable + 1');
    const mode = action.params.mode || 'set';

    // Resolve the expression — replace common tokens with actual values
    let resolvedExpr = expression;

    // Replace "variable" with the current value
    if (currentValue !== undefined) {
      resolvedExpr = resolvedExpr.replace(/\bvariable\b/g, String(currentValue));
    }

    // Replace references to other variables by name.
    // For scope=object, also resolve other object vars on the same part.
    if (scope === 'object' && part && isPart(part) && part.objectVariables) {
      for (const [name, val] of Object.entries(part.objectVariables)) {
        if (name !== varName) {
          resolvedExpr = resolvedExpr.replace(new RegExp(`\\b${name}\\b`, 'g'), String(val));
        }
      }
    }
    // Always allow referencing globals too (mixed scope).
    for (const [name, val] of Object.entries(state.globalVariables)) {
      if (name !== varName) {
        resolvedExpr = resolvedExpr.replace(new RegExp(`\\b${name}\\b`, 'g'), String(val));
      }
    }

    // Replace common math functions
    resolvedExpr = resolvedExpr.replace(/\bsqrt\b/g, 'Math.sqrt');
    resolvedExpr = resolvedExpr.replace(/\babs\b/g, 'Math.abs');
    resolvedExpr = resolvedExpr.replace(/\bfloor\b/g, 'Math.floor');
    resolvedExpr = resolvedExpr.replace(/\bceil\b/g, 'Math.ceil');
    resolvedExpr = resolvedExpr.replace(/\bround\b/g, 'Math.round');
    resolvedExpr = resolvedExpr.replace(/\bsin\b/g, 'Math.sin');
    resolvedExpr = resolvedExpr.replace(/\bcos\b/g, 'Math.cos');
    resolvedExpr = resolvedExpr.replace(/\btan\b/g, 'Math.tan');
    resolvedExpr = resolvedExpr.replace(/\bpow\b/g, 'Math.pow');
    resolvedExpr = resolvedExpr.replace(/\bmin\b/g, 'Math.min');
    resolvedExpr = resolvedExpr.replace(/\bmax\b/g, 'Math.max');
    resolvedExpr = resolvedExpr.replace(/\bPI\b/g, 'Math.PI');

    // Replace timeOfDay with current world time
    resolvedExpr = resolvedExpr.replace(/\btimeOfDay\b/g, String(state.worldSettings.timeOfDay));

    // Safely evaluate the expression
    let result: number;
    try {
      // Use Function constructor for safe-ish evaluation (no access to scope)
      const fn = new Function(`"use strict"; return (${resolvedExpr})`);
      result = Number(fn());
      if (!isFinite(result)) {
        state.addConsoleMessage('warn', `[WeildCode] change_variable: expression resulted in ${result}`);
        return;
      }
    } catch (e) {
      state.addConsoleMessage('warn', `[WeildCode] change_variable: failed to evaluate "${expression}"`);
      return;
    }

    // Apply the result based on mode
    let newValue: number | string;
    const currentNum = Number(currentValue) || 0;
    if (mode === 'add') {
      newValue = currentNum + result;
    } else if (mode === 'multiply') {
      newValue = currentNum * result;
    } else {
      newValue = result; // set
    }

    if (scope === 'object') {
      state.setObjectVariable(partId, varName, newValue);
      state.addConsoleMessage('info', `[WeildCode] Changed object variable "${varName}" to ${newValue} (mode: ${mode})`);
    } else {
      state.setGlobalVariable(varName, newValue);
      state.addConsoleMessage('info', `[WeildCode] Changed variable "${varName}" to ${newValue} (mode: ${mode})`);
    }
  }

  // ─── Variable Trigger Polling ───

  private updateVariableTriggers(dt: number, state: ReturnType<typeof useStudioStore.getState>) {
    const currentVars = state.globalVariables;

    // ── Global variable change detection (existing) ──
    const changedVars = new Set<string>();
    for (const [name, value] of Object.entries(currentVars)) {
      const prev = this.variableSnapshots.get(name);
      if (prev !== value) {
        changedVars.add(name);
        this.variableSnapshots.set(name, value);
      }
    }
    // Also detect deleted variables
    for (const [name] of this.variableSnapshots) {
      if (!(name in currentVars)) {
        changedVars.add(name);
        this.variableSnapshots.delete(name);
      }
    }

    // ── Per-object variable change detection (new) ──
    // Build a map: partId -> set of changed var names
    const changedObjectVars = new Map<string, Set<string>>();
    state.objects.forEach((obj) => {
      if (!isPart(obj)) return;
      const current = obj.objectVariables || {};
      const prev = this.objectVariableSnapshots.get(obj.id) || new Map<string, number | string>();
      const changed = new Set<string>();
      // Detect value changes and new vars
      for (const [name, value] of Object.entries(current)) {
        if (prev.get(name) !== value) {
          changed.add(name);
        }
      }
      // Detect deleted vars
      for (const [name] of prev) {
        if (!(name in current)) {
          changed.add(name);
        }
      }
      if (changed.size > 0) {
        changedObjectVars.set(obj.id, changed);
        // Update snapshot to current
        const snap = new Map<string, number | string>();
        for (const [name, value] of Object.entries(current)) {
          snap.set(name, value);
        }
        this.objectVariableSnapshots.set(obj.id, snap);
      }
    });

    // ── Fire when_variable_changes ──
    // Global scope
    if (changedVars.size > 0) {
      state.objects.forEach((obj) => {
        if (!isPart(obj)) return;
        const rules = obj.rules || [];
        for (const rule of rules) {
          if (!rule.enabled || rule.trigger.type !== 'when_variable_changes') continue;
          const scope = rule.trigger.params.scope || 'global';
          if (scope !== 'global') continue; // handled below
          const varName = rule.trigger.params.variableName || '';
          if (changedVars.has(varName)) {
            this.executeActions(obj.id, rule.actions, rule.id);
          }
        }
      });
    }
    // Object scope — only fire on the part that owns the variable
    if (changedObjectVars.size > 0) {
      changedObjectVars.forEach((changedSet, partId) => {
        const obj = state.objects.get(partId);
        if (!obj || !isPart(obj)) return;
        const rules = obj.rules || [];
        for (const rule of rules) {
          if (!rule.enabled || rule.trigger.type !== 'when_variable_changes') continue;
          const scope = rule.trigger.params.scope || 'global';
          if (scope !== 'object') continue;
          const varName = rule.trigger.params.variableName || '';
          if (changedSet.has(varName)) {
            this.executeActions(obj.id, rule.actions, rule.id);
          }
        }
      });
    }

    // ── Poll when_variable_equals ──
    state.objects.forEach((obj) => {
      if (!isPart(obj)) return;
      const rules = obj.rules || [];
      for (const rule of rules) {
        if (!rule.enabled || rule.trigger.type !== 'when_variable_equals') continue;
        const varName = rule.trigger.params.variableName || '';
        const targetValue = rule.trigger.params.value ?? '';
        const checkInterval = rule.trigger.params.checkInterval ?? 0.5;
        const scope = rule.trigger.params.scope || 'global';

        const key = `${obj.id}_${rule.id}`;
        let acc = this.variableCheckAccumulators.get(key) || 0;
        acc += dt;
        if (acc >= checkInterval) {
          acc = 0;
          const currentValue = scope === 'object'
            ? obj.objectVariables?.[varName]
            : currentVars[varName];
          if (currentValue !== undefined && String(currentValue) === String(targetValue)) {
            this.executeActions(obj.id, rule.actions, rule.id);
          }
        }
        this.variableCheckAccumulators.set(key, acc);
      }
    });
  }

  // ─── Condition Trigger Polling ───

  private updateConditionTriggers(dt: number, state: ReturnType<typeof useStudioStore.getState>) {
    state.objects.forEach((obj) => {
      if (!isPart(obj)) return;
      const rules = obj.rules || [];
      for (const rule of rules) {
        if (!rule.enabled) continue;

        // when_coinflip
        if (rule.trigger.type === 'when_coinflip') {
          const key = `${obj.id}_${rule.id}`;
          const chancePercent = rule.trigger.params.chancePercent ?? 50;
          const repeat = rule.trigger.params.repeat || 'every';

          if (repeat === 'once' && this.coinFlipFired.has(key)) continue;

          let acc = this.conditionCheckAccumulators.get(key) || 0;
          acc += dt;
          if (acc >= 1.0) { // check every second
            acc = 0;
            const roll = Math.random() * 100;
            if (roll < chancePercent) {
              this.executeActions(obj.id, rule.actions, rule.id);
              if (repeat === 'once') {
                this.coinFlipFired.add(key);
              }
            }
          }
          this.conditionCheckAccumulators.set(key, acc);
        }

        // when_condition
        if (rule.trigger.type === 'when_condition') {
          const key = `${obj.id}_${rule.id}`;
          const condition = rule.trigger.params.condition || 'anchored';
          const checkInterval = rule.trigger.params.checkInterval ?? 0.5;

          let acc = this.conditionCheckAccumulators.get(key) || 0;
          acc += dt;
          if (acc >= checkInterval) {
            acc = 0;
            const part = state.objects.get(obj.id);
            if (part && isPart(part) && this.evaluateCondition(part, condition, rule.trigger.params, state)) {
              this.executeActions(obj.id, rule.actions, rule.id);
            }
          }
          this.conditionCheckAccumulators.set(key, acc);
        }
      }
    });
  }

  private evaluateCondition(part: StudioPart, condition: string, params: Record<string, any>, state: ReturnType<typeof useStudioStore.getState>): boolean {
    switch (condition) {
      case 'anchored': return part.anchored;
      case 'canCollide': return part.canCollide;
      case 'hasEffect': return (part.effects || []).length > 0;
      case 'hasBodyMover': return part.bodyMovers.length > 0;
      case 'isWelded': return state.joints.some(j => j.enabled && (j.partAId === part.id || j.partBId === part.id) && j.type === 'Weld');
      case 'isRoped': return state.joints.some(j => j.enabled && (j.partAId === part.id || j.partBId === part.id) && j.type === 'Rope');
      case 'shapeBlock': return part.type === 'Block';
      case 'shapeSphere': return part.type === 'Sphere';
      case 'shapeCylinder': return part.type === 'Cylinder';
      case 'shapeWedge': return part.type === 'Wedge';
      case 'propertyEquals': {
        const propertyName = params.propertyName || 'size';
        const propertyValue = params.propertyValue || '';
        switch (propertyName) {
          case 'size': return `${part.size.x},${part.size.y},${part.size.z}` === propertyValue;
          case 'rotation': return `${part.rotation.x},${part.rotation.y},${part.rotation.z}` === propertyValue;
          case 'color': return part.color === propertyValue;
          case 'material': return part.material === propertyValue;
          case 'friction': return String(part.friction) === propertyValue;
          case 'elasticity': return String(part.elasticity) === propertyValue;
          case 'density': return String(part.density) === propertyValue;
          case 'mass': return String(part.size.x * part.size.y * part.size.z * part.density) === propertyValue;
          case 'transparency': return String(part.transparency) === propertyValue;
          case 'reflectance': return String(part.reflectance) === propertyValue;
          case 'name': return part.name === propertyValue;
          default: return false;
        }
      }
      default: return false;
    }
  }

  // ─── Name Label Management ───

  private updateNameLabels() {
    const now = performance.now();
    const expired: string[] = [];
    for (const [partId, label] of this.nameLabels.entries()) {
      if (label.duration > 0 && (now - label.startTime) / 1000 >= label.duration) {
        expired.push(partId);
      }
    }
    for (const id of expired) {
      this.nameLabels.delete(id);
    }
  }

  /** Get all active name labels — used by Viewport3D to render them */
  getNameLabels(): Array<{ partId: string; text: string; color: string; fontSize: number }> {
    const result: Array<{ partId: string; text: string; color: string; fontSize: number }> = [];
    for (const [partId, label] of this.nameLabels.entries()) {
      result.push({ partId, text: label.text, color: label.color, fontSize: label.fontSize });
    }
    return result;
  }

  // ─── Event Handlers (called from Viewport3D) ───

  handleClick(partId: string) {
    this.fireTrigger(partId, 'when_clicked');
  }

  handleTouch(partId: string, touchType: 'player' | 'parts' | 'any' = 'any') {
    this.fireTrigger(partId, 'when_touched', { touchType });
  }

  handleDestroyed(partId: string) {
    this.fireTrigger(partId, 'when_destroyed');
    this.createdParts.delete(partId);
  }

  handlePropertyChanged(partId: string, property: string) {
    this.fireTrigger(partId, 'on_property_change', { property });
  }
}

// ─── Singleton Engine Instance ───

export const weildCodeEngine = new WeildCodeEngine();

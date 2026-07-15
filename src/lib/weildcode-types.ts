// ═══════════════════════════════════════════════════════════════════
// WeildCode — Trigger-Action Scripting Language for WeildBuild
// ═══════════════════════════════════════════════════════════════════

// ─── Triggers (Events that fire rules) ───

export type TriggerType =
  | 'when_created'       // Object spawns into the world
  | 'when_clicked'       // Player clicks the object
  | 'when_touched'       // Another part or player touches this
  | 'when_destroyed'     // Object is about to be removed
  | 'on_timer'           // Repeating or one-shot timer
  | 'on_property_change' // A property (color, position, etc.) changes
  | 'when_time_is'       // Game world time reaches a value
  | 'when_weather_is'    // Weather state matches
  | 'when_variable_equals' // A global variable equals a value
  | 'when_variable_changes' // A global variable changes
  | 'when_coinflip'      // Coin flip with set chance
  | 'when_condition';    // Condition check (anchored, can collide, has effect, etc.)

export interface TriggerParam {
  key: string;
  label: string;
  type: 'number' | 'string' | 'select' | 'vector3' | 'color';
  default?: any;
  options?: { label: string; value: string }[];
}

export interface TriggerDefinition {
  type: TriggerType;
  label: string;
  description: string;
  icon: string;           // Lucide icon name
  params: TriggerParam[];
}

/** Full catalog of available triggers */
export const TRIGGER_DEFINITIONS: TriggerDefinition[] = [
  {
    type: 'when_created',
    label: 'When this is created',
    description: 'Fires when this object appears in the world',
    icon: 'Plus',
    params: [],
  },
  {
    type: 'when_clicked',
    label: 'When this is clicked',
    description: 'Fires when a player clicks this object',
    icon: 'MousePointerClick',
    params: [],
  },
  {
    type: 'when_touched',
    label: 'When this is touched',
    description: 'Fires when another part or player touches this object',
    icon: 'Hand',
    params: [
      {
        key: 'filter',
        label: 'Touch filter',
        type: 'select',
        default: 'any',
        options: [
          { label: 'Anything', value: 'any' },
          { label: 'Player only', value: 'player' },
          { label: 'Parts only', value: 'parts' },
        ],
      },
    ],
  },
  {
    type: 'when_destroyed',
    label: 'When this is destroyed',
    description: 'Fires just before this object is removed',
    icon: 'Trash2',
    params: [],
  },
  {
    type: 'on_timer',
    label: 'On timer',
    description: 'Fires after a delay or on a repeating interval',
    icon: 'Clock',
    params: [
      {
        key: 'intervalSeconds',
        label: 'Interval (seconds)',
        type: 'number',
        default: 1,
      },
      {
        key: 'repeat',
        label: 'Repeat',
        type: 'select',
        default: 'every',
        options: [
          { label: 'Once after delay', value: 'once' },
          { label: 'Every N seconds', value: 'every' },
        ],
      },
    ],
  },
  {
    type: 'on_property_change',
    label: 'When property changes',
    description: 'Fires when a specific property of this object changes',
    icon: 'RefreshCw',
    params: [
      {
        key: 'property',
        label: 'Property',
        type: 'select',
        default: 'any',
        options: [
          { label: 'Any property', value: 'any' },
          { label: 'Position', value: 'position' },
          { label: 'Color', value: 'color' },
          { label: 'Size', value: 'size' },
          { label: 'Transparency', value: 'transparency' },
          { label: 'Material', value: 'material' },
        ],
      },
    ],
  },
  {
    type: 'when_time_is',
    label: 'When time is',
    description: 'Fires when the world clock reaches a specific time',
    icon: 'Sun',
    params: [
      {
        key: 'timeValue',
        label: 'Time',
        type: 'string',
        default: '12:00',
      },
      {
        key: 'timeMode',
        label: 'Time mode',
        type: 'select',
        default: 'exact',
        options: [
          { label: 'Exact time (e.g. 16:45)', value: 'exact' },
          { label: 'Time of day (dawn/noon/dusk/midnight)', value: 'period' },
        ],
      },
      {
        key: 'period',
        label: 'Period',
        type: 'select',
        default: 'noon',
        options: [
          { label: 'Dawn (5:00–7:00)', value: 'dawn' },
          { label: 'Morning (7:00–11:00)', value: 'morning' },
          { label: 'Noon (11:00–13:00)', value: 'noon' },
          { label: 'Afternoon (13:00–17:00)', value: 'afternoon' },
          { label: 'Dusk (17:00–19:00)', value: 'dusk' },
          { label: 'Evening (19:00–22:00)', value: 'evening' },
          { label: 'Midnight (22:00–5:00)', value: 'midnight' },
        ],
      },
    ],
  },
  {
    type: 'when_weather_is',
    label: 'When weather is',
    description: 'Fires when the weather changes to a specific type',
    icon: 'Cloud',
    params: [
      {
        key: 'weatherType',
        label: 'Weather',
        type: 'select',
        default: 'rain',
        options: [
          { label: 'Clear', value: 'clear' },
          { label: 'Cloudy', value: 'cloudy' },
          { label: 'Rain', value: 'rain' },
          { label: 'Snow', value: 'snow' },
        ],
      },
    ],
  },
  {
    type: 'when_variable_equals',
    label: 'When variable equals',
    description: 'Fires when a global or object-scoped variable equals a specific value',
    icon: 'Variable',
    params: [
      { key: 'variableName', label: 'Variable name', type: 'string', default: '' },
      { key: 'value', label: 'Value', type: 'string', default: '0' },
      { key: 'checkInterval', label: 'Check interval (seconds)', type: 'number', default: 0.5 },
      { key: 'scope', label: 'Scope', type: 'select', default: 'global', options: [
        { label: 'Global (any object can read)', value: 'global' },
        { label: 'Object (this part only)', value: 'object' },
      ]},
    ],
  },
  {
    type: 'when_variable_changes',
    label: 'When variable changes',
    description: 'Fires when a global or object-scoped variable changes value',
    icon: 'Variable',
    params: [
      { key: 'variableName', label: 'Variable name', type: 'string', default: '' },
      { key: 'scope', label: 'Scope', type: 'select', default: 'global', options: [
        { label: 'Global (any object can read)', value: 'global' },
        { label: 'Object (this part only)', value: 'object' },
      ]},
    ],
  },
  {
    type: 'when_coinflip',
    label: 'Coin flip',
    description: 'Fires based on a random chance (like a coin flip)',
    icon: 'Zap',
    params: [
      { key: 'chancePercent', label: 'Chance (%)', type: 'number', default: 50 },
      { key: 'repeat', label: 'Repeat', type: 'select', default: 'every', options: [
        { label: 'Check once', value: 'once' },
        { label: 'Check every second', value: 'every' },
      ]},
    ],
  },
  {
    type: 'when_condition',
    label: 'When condition is met',
    description: 'Fires when a condition about this object is true',
    icon: 'Check',
    params: [
      { key: 'condition', label: 'Condition', type: 'select', default: 'anchored', options: [
        { label: 'Is anchored', value: 'anchored' },
        { label: 'Can collide', value: 'canCollide' },
        { label: 'Has effect', value: 'hasEffect' },
        { label: 'Has body mover', value: 'hasBodyMover' },
        { label: 'Is welded', value: 'isWelded' },
        { label: 'Is roped', value: 'isRoped' },
        { label: 'Shape is Block', value: 'shapeBlock' },
        { label: 'Shape is Sphere', value: 'shapeSphere' },
        { label: 'Shape is Cylinder', value: 'shapeCylinder' },
        { label: 'Shape is Wedge', value: 'shapeWedge' },
        { label: 'Property equals', value: 'propertyEquals' },
      ]},
      { key: 'propertyName', label: 'Property', type: 'select', default: 'size', options: [
        { label: 'Size', value: 'size' },
        { label: 'Rotation', value: 'rotation' },
        { label: 'Color', value: 'color' },
        { label: 'Material', value: 'material' },
        { label: 'Friction', value: 'friction' },
        { label: 'Elasticity', value: 'elasticity' },
        { label: 'Density', value: 'density' },
        { label: 'Mass', value: 'mass' },
        { label: 'Transparency', value: 'transparency' },
        { label: 'Reflectance', value: 'reflectance' },
        { label: 'Name', value: 'name' },
      ]},
      { key: 'propertyValue', label: 'Value', type: 'string', default: '' },
      { key: 'checkInterval', label: 'Check interval (seconds)', type: 'number', default: 0.5 },
    ],
  },
];

// ─── Actions (Things that happen when a trigger fires) ───

export type ActionType =
  | 'create_part'          // Create a new part
  | 'remove_from_workspace' // Remove from workspace (persists across sessions)
  | 'delete_part'          // Delete part (session-only, restores on reload)
  | 'move'                 // Move to position / by offset
  | 'rotate'               // Rotate by degrees
  | 'resize'               // Resize by factor or absolute
  | 'change_color'         // Change color
  | 'change_material'      // Change material
  | 'change_transparency'  // Change transparency
  | 'apply_force'          // Apply a directional force
  | 'apply_explosion'      // Create an explosion
  | 'wait'                 // Wait N seconds
  | 'play_sound'           // Play a sound effect
  | 'visual_effect'        // Fire / smoke / light
  | 'repeat'               // Repeat N times
  | 'repeat_every'         // Repeat every N seconds
  | 'tell_object'          // Tell another object to perform actions
  | 'print_message'        // Show a message on the player's screen
  | 'show_name'            // Show name above part
  | 'create_copy'          // Create a copy of a part
  | 'add_rule'             // Add a rule to an object
  | 'set_variable'         // Set a variable value
  | 'change_variable'      // Change a variable value (with math)
  | 'send_to_universe';    // Send player to another universe

export interface ActionParam {
  key: string;
  label: string;
  type: 'number' | 'string' | 'select' | 'vector3' | 'color' | 'boolean';
  default?: any;
  options?: { label: string; value: string }[];
}

export interface ActionDefinition {
  type: ActionType;
  label: string;
  description: string;
  icon: string;
  params: ActionParam[];
  /** If true, this action can contain nested child actions */
  hasChildren?: boolean;
  childLabel?: string;
}

/** Full catalog of available actions */
export const ACTION_DEFINITIONS: ActionDefinition[] = [
  {
    type: 'create_part',
    label: 'Create a part',
    description: 'Create a new part in the world',
    icon: 'Plus',
    params: [
      { key: 'partType', label: 'Shape', type: 'select', default: 'Block', options: [
        { label: 'Block', value: 'Block' },
        { label: 'Sphere', value: 'Sphere' },
        { label: 'Wedge', value: 'Wedge' },
        { label: 'Cylinder', value: 'Cylinder' },
      ]},
      { key: 'partName', label: 'Name', type: 'string', default: 'NewPart' },
      { key: 'position', label: 'Position (x,y,z)', type: 'vector3', default: { x: 0, y: 1, z: 0 } },
      { key: 'color', label: 'Color', type: 'color', default: '#4ff7f5' },
    ],
  },
  {
    type: 'remove_from_workspace',
    label: 'Remove from workspace',
    description: 'Remove this object from the workspace permanently',
    icon: 'Trash2',
    params: [
      { key: 'target', label: 'Target', type: 'select', default: 'self', options: [
        { label: 'This object', value: 'self' },
        { label: 'Named object', value: 'named' },
      ]},
      { key: 'targetName', label: 'Object name', type: 'string', default: '' },
    ],
  },
  {
    type: 'delete_part',
    label: 'Delete part',
    description: 'Delete this object for this session only (restores on reload)',
    icon: 'X',
    params: [
      { key: 'target', label: 'Target', type: 'select', default: 'self', options: [
        { label: 'This object', value: 'self' },
        { label: 'Named object', value: 'named' },
      ]},
      { key: 'targetName', label: 'Object name', type: 'string', default: '' },
    ],
  },
  {
    type: 'move',
    label: 'Move',
    description: 'Move this object to a position or by an offset',
    icon: 'Move',
    params: [
      { key: 'mode', label: 'Mode', type: 'select', default: 'offset', options: [
        { label: 'To position', value: 'absolute' },
        { label: 'By offset', value: 'offset' },
      ]},
      { key: 'position', label: 'Position / Offset (x,y,z)', type: 'vector3', default: { x: 0, y: 1, z: 0 } },
    ],
  },
  {
    type: 'rotate',
    label: 'Rotate',
    description: 'Rotate this object by degrees',
    icon: 'RotateCcw',
    params: [
      { key: 'rotation', label: 'Rotation (x,y,z) degrees', type: 'vector3', default: { x: 0, y: 90, z: 0 } },
    ],
  },
  {
    type: 'resize',
    label: 'Resize',
    description: 'Change the size of this object',
    icon: 'Maximize2',
    params: [
      { key: 'mode', label: 'Mode', type: 'select', default: 'offset', options: [
        { label: 'To size', value: 'absolute' },
        { label: 'By offset', value: 'offset' },
        { label: 'Multiply', value: 'multiply' },
      ]},
      { key: 'size', label: 'Size / Offset / Factor (x,y,z)', type: 'vector3', default: { x: 1, y: 1, z: 1 } },
    ],
  },
  {
    type: 'change_color',
    label: 'Change color',
    description: 'Change this object\'s color',
    icon: 'Palette',
    params: [
      { key: 'color', label: 'Color', type: 'color', default: '#ff0000' },
    ],
  },
  {
    type: 'change_material',
    label: 'Change material',
    description: 'Change this object\'s material',
    icon: 'PaintBucket',
    params: [
      { key: 'material', label: 'Material', type: 'select', default: 'Plastic', options: [
        { label: 'Plastic', value: 'Plastic' },
        { label: 'Wood', value: 'Wood' },
        { label: 'Slate', value: 'Slate' },
        { label: 'Concrete', value: 'Concrete' },
        { label: 'Metal', value: 'Metal' },
        { label: 'DiamondPlate', value: 'DiamondPlate' },
        { label: 'Grass', value: 'Grass' },
        { label: 'Ice', value: 'Ice' },
        { label: 'Brick', value: 'Brick' },
        { label: 'Sand', value: 'Sand' },
        { label: 'Neon', value: 'Neon' },
        { label: 'SmoothPlastic', value: 'SmoothPlastic' },
        { label: 'CorrodedMetal', value: 'CorrodedMetal' },
        { label: 'Foil', value: 'Foil' },
        { label: 'Granite', value: 'Granite' },
        { label: 'Marble', value: 'Marble' },
      ]},
    ],
  },
  {
    type: 'change_transparency',
    label: 'Change transparency',
    description: 'Set this object\'s transparency (0 = solid, 1 = invisible)',
    icon: 'Eye',
    params: [
      { key: 'transparency', label: 'Transparency', type: 'number', default: 0.5 },
    ],
  },
  {
    type: 'apply_force',
    label: 'Apply force',
    description: 'Apply a directional force to this object',
    icon: 'Zap',
    params: [
      { key: 'force', label: 'Force (x,y,z)', type: 'vector3', default: { x: 0, y: 50, z: 0 } },
    ],
  },
  {
    type: 'apply_explosion',
    label: 'Create explosion',
    description: 'Create an explosion at this object\'s position',
    icon: 'Flame',
    params: [
      { key: 'radius', label: 'Blast radius', type: 'number', default: 8 },
      { key: 'pressure', label: 'Blast pressure', type: 'number', default: 500000 },
    ],
  },
  {
    type: 'wait',
    label: 'Wait',
    description: 'Wait before executing the next action',
    icon: 'Clock',
    params: [
      { key: 'seconds', label: 'Seconds', type: 'number', default: 1 },
    ],
  },
  {
    type: 'play_sound',
    label: 'Play sound',
    description: 'Play a sound effect',
    icon: 'Volume2',
    params: [
      { key: 'sound', label: 'Sound', type: 'select', default: 'click', options: [
        { label: 'Click', value: 'click' },
        { label: 'Pop', value: 'pop' },
        { label: 'Boom', value: 'boom' },
        { label: 'Whoosh', value: 'whoosh' },
        { label: 'Chime', value: 'chime' },
        { label: 'Alert', value: 'alert' },
      ]},
      { key: 'volume', label: 'Volume (0-1)', type: 'number', default: 0.5 },
    ],
  },
  {
    type: 'visual_effect',
    label: 'Visual effect',
    description: 'Add a fire, smoke, or light effect',
    icon: 'Sparkles',
    params: [
      { key: 'effectType', label: 'Effect', type: 'select', default: 'Fire', options: [
        { label: 'Fire', value: 'Fire' },
        { label: 'Smoke', value: 'Smoke' },
        { label: 'Light', value: 'Light' },
      ]},
      { key: 'color', label: 'Color', type: 'color', default: '#ff6600' },
      { key: 'size', label: 'Size', type: 'number', default: 3 },
    ],
  },
  {
    type: 'repeat',
    label: 'Repeat N times',
    description: 'Repeat the nested actions a number of times',
    icon: 'Repeat',
    params: [
      { key: 'count', label: 'Count', type: 'number', default: 3 },
      { key: 'delayBetween', label: 'Delay between (seconds)', type: 'number', default: 0 },
    ],
    hasChildren: true,
    childLabel: 'Do',
  },
  {
    type: 'repeat_every',
    label: 'Repeat every N seconds',
    description: 'Repeat the nested actions on a timer',
    icon: 'Timer',
    params: [
      { key: 'intervalSeconds', label: 'Every N seconds', type: 'number', default: 2 },
      { key: 'maxRepeats', label: 'Max repeats (0 = forever)', type: 'number', default: 0 },
    ],
    hasChildren: true,
    childLabel: 'Do',
  },
  {
    type: 'tell_object',
    label: 'Tell another object to perform',
    description: 'Send a command to another named object',
    icon: 'MessageSquare',
    params: [
      { key: 'targetName', label: 'Object name', type: 'string', default: '' },
    ],
    hasChildren: true,
    childLabel: 'Perform',
  },
  {
    type: 'print_message',
    label: 'Print message',
    description: 'Show a message on the player\'s screen',
    icon: 'Type',
    params: [
      { key: 'message', label: 'Message', type: 'string', default: 'Hello, world!' },
      { key: 'position', label: 'Position', type: 'select', default: 'bottom', options: [
        { label: 'Top of screen', value: 'top' },
        { label: 'Bottom of screen', value: 'bottom' },
      ]},
      { key: 'textColor', label: 'Text color', type: 'color', default: '#ffffff' },
      { key: 'fontStyle', label: 'Font style', type: 'select', default: 'normal', options: [
        { label: 'Normal', value: 'normal' },
        { label: 'Bold', value: 'bold' },
        { label: 'Italic', value: 'italic' },
        { label: 'Bold Italic', value: 'bold-italic' },
      ]},
      { key: 'fontSize', label: 'Font size', type: 'number', default: 24 },
      { key: 'backgroundColor', label: 'Background', type: 'color', default: '#000000' },
      { key: 'duration', label: 'Duration (sec)', type: 'number', default: 3 },
    ],
  },
  {
    type: 'show_name',
    label: 'Show name above part',
    description: 'Display a text label above this part (max 12 characters)',
    icon: 'Type',
    params: [
      { key: 'text', label: 'Text (max 12 chars)', type: 'string', default: 'Hello' },
      { key: 'color', label: 'Text color', type: 'color', default: '#ffffff' },
      { key: 'fontSize', label: 'Font size', type: 'number', default: 16 },
      { key: 'duration', label: 'Duration (sec, 0 = forever)', type: 'number', default: 5 },
    ],
  },
  {
    type: 'create_copy',
    label: 'Create copy of part',
    description: 'Create a copy of this object (or a named object)',
    icon: 'Copy',
    params: [
      { key: 'target', label: 'Target', type: 'select', default: 'self', options: [
        { label: 'This object', value: 'self' },
        { label: 'Named object', value: 'named' },
      ]},
      { key: 'targetName', label: 'Object name', type: 'string', default: '' },
      { key: 'copyName', label: 'Copy name', type: 'string', default: '' },
      { key: 'count', label: 'Number of copies', type: 'number', default: 1 },
      { key: 'offset', label: 'Offset between copies (x,y,z)', type: 'vector3', default: { x: 2, y: 0, z: 0 } },
    ],
  },
  {
    type: 'add_rule',
    label: 'Add a rule',
    description: 'Add a trigger-action rule to this object or a named object',
    icon: 'Plus',
    params: [
      { key: 'target', label: 'Target', type: 'select', default: 'self', options: [
        { label: 'This object', value: 'self' },
        { label: 'Named object', value: 'named' },
      ]},
      { key: 'targetName', label: 'Object name', type: 'string', default: '' },
      { key: 'triggerType', label: 'Trigger', type: 'select', default: 'when_clicked', options: [
        { label: 'When clicked', value: 'when_clicked' },
        { label: 'When touched', value: 'when_touched' },
        { label: 'When created', value: 'when_created' },
        { label: 'On timer', value: 'on_timer' },
      ]},
      { key: 'actionType', label: 'Action', type: 'select', default: 'print_message', options: [
        { label: 'Print message', value: 'print_message' },
        { label: 'Move', value: 'move' },
        { label: 'Change color', value: 'change_color' },
        { label: 'Apply force', value: 'apply_force' },
        { label: 'Create explosion', value: 'apply_explosion' },
      ]},
    ],
  },
  {
    type: 'set_variable',
    label: 'Set variable',
    description: 'Set a global or object-scoped variable to a value',
    icon: 'Variable',
    params: [
      { key: 'variableName', label: 'Variable name', type: 'string', default: '' },
      { key: 'value', label: 'Value', type: 'string', default: '0' },
      { key: 'scope', label: 'Scope', type: 'select', default: 'global', options: [
        { label: 'Global (any object can read)', value: 'global' },
        { label: 'Object (this part only)', value: 'object' },
      ]},
    ],
  },
  {
    type: 'change_variable',
    label: 'Change variable',
    description: 'Change a global or object-scoped variable using a math expression (e.g. score + 1, sqrt(time))',
    icon: 'Variable',
    params: [
      { key: 'variableName', label: 'Variable name', type: 'string', default: '' },
      { key: 'expression', label: 'Math expression', type: 'string', default: 'variable + 1' },
      { key: 'mode', label: 'Mode', type: 'select', default: 'set', options: [
        { label: 'Set to result', value: 'set' },
        { label: 'Add result', value: 'add' },
        { label: 'Multiply by result', value: 'multiply' },
      ]},
      { key: 'scope', label: 'Scope', type: 'select', default: 'global', options: [
        { label: 'Global (any object can read)', value: 'global' },
        { label: 'Object (this part only)', value: 'object' },
      ]},
    ],
  },
  {
    type: 'send_to_universe',
    label: 'Send player to Universe',
    description: 'Teleport the player to another universe in this game',
    icon: 'Globe',
    params: [
      { key: 'universeId', label: 'Universe', type: 'select', default: '', options: [
        { label: 'Start (default)', value: 'place_default' },
      ]},
    ],
  },
];

// ─── Rule (Trigger + Actions) ───

export interface WeildCodeAction {
  id: string;
  type: ActionType;
  params: Record<string, any>;
  children?: WeildCodeAction[];  // Nested actions for repeat/tell_object
  enabled: boolean;
}

export interface WeildCodeRule {
  id: string;
  name: string;
  trigger: {
    type: TriggerType;
    params: Record<string, any>;
  };
  actions: WeildCodeAction[];
  mode: 'simple' | 'advanced';
  advancedCode?: string;  // Raw WeildCode text for advanced mode
  enabled: boolean;
}

// ─── Helper to create a blank rule ───

export function createBlankRule(mode: 'simple' | 'advanced'): WeildCodeRule {
  return {
    id: `rule_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: 'New Rule',
    trigger: { type: 'when_created', params: {} },
    actions: [],
    mode,
    enabled: true,
  };
}

export function createBlankAction(type: ActionType): WeildCodeAction {
  const def = ACTION_DEFINITIONS.find((d) => d.type === type);
  const params: Record<string, any> = {};
  if (def) {
    for (const p of def.params) {
      params[p.key] = p.default ?? '';
    }
  }
  return {
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type,
    params,
    children: def?.hasChildren ? [] : undefined,
    enabled: true,
  };
}

// ─── WeildCode Advanced Syntax Parser ───
// Converts between simple mode (structured) and advanced mode (text)

export function ruleToAdvancedCode(rule: WeildCodeRule): string {
  const triggerDef = TRIGGER_DEFINITIONS.find((d) => d.type === rule.trigger.type);
  const triggerKeyword = rule.trigger.type;

  let paramsStr = '';
  if (Object.keys(rule.trigger.params).length > 0) {
    paramsStr = ' ' + Object.entries(rule.trigger.params)
      .map(([k, v]) => `${k}="${v}"`)
      .join(' ');
  }

  let code = `${triggerKeyword}${paramsStr} {\n`;

  for (const action of rule.actions) {
    code += '  ' + actionToCode(action, 1) + '\n';
  }

  code += '}\n';
  return code;
}

function actionToCode(action: WeildCodeAction, indent: number): string {
  const pad = '  '.repeat(indent);
  const def = ACTION_DEFINITIONS.find((d) => d.type === action.type);

  let paramsStr = '';
  const paramEntries = Object.entries(action.params).filter(([_, v]) => v !== undefined && v !== '');
  if (paramEntries.length > 0) {
    paramsStr = ' ' + paramEntries
      .map(([k, v]) => {
        if (typeof v === 'object' && v !== null) {
          return `${k}=${v.x},${v.y},${v.z}`;
        }
        return `${k}="${v}"`;
      })
      .join(' ');
  }

  if (def?.hasChildren && action.children && action.children.length > 0) {
    let code = `${action.type}${paramsStr} {\n`;
    for (const child of action.children) {
      code += pad + '  ' + actionToCode(child, indent + 1) + '\n';
    }
    code += pad + '}\n';
    return code;
  }

  return `${action.type}${paramsStr}`;
}

/** Parse advanced WeildCode text into a rule (basic parser) */
export function parseAdvancedCode(code: string): { trigger: WeildCodeRule['trigger']; actions: WeildCodeAction[] } | null {
  try {
    const trimmed = code.trim();
    // Find the trigger keyword and opening brace
    const braceIndex = trimmed.indexOf('{');
    if (braceIndex === -1) return null;

    const triggerPart = trimmed.substring(0, braceIndex).trim();
    const bodyPart = trimmed.substring(braceIndex + 1, trimmed.lastIndexOf('}')).trim();

    // Parse trigger
    const triggerWords = triggerPart.split(/\s+/);
    const triggerType = triggerWords[0] as TriggerType;
    const triggerParams: Record<string, any> = {};

    // Parse trigger params (key="value" format)
    for (let i = 1; i < triggerWords.length; i++) {
      const match = triggerWords[i].match(/^(\w+)="([^"]*)"$/);
      if (match) {
        triggerParams[match[1]] = match[2];
      }
    }

    // Parse actions (line by line, basic parsing)
    const actions: WeildCodeAction[] = [];
    const lines = bodyPart.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//'));

    for (const line of lines) {
      if (line === '{' || line === '}') continue;
      const action = parseActionCode(line);
      if (action) actions.push(action);
    }

    return { trigger: { type: triggerType, params: triggerParams }, actions };
  } catch {
    return null;
  }
}

function parseActionCode(line: string): WeildCodeAction | null {
  const words = line.trim().split(/\s+/);
  if (words.length === 0) return null;

  const actionType = words[0] as ActionType;
  const def = ACTION_DEFINITIONS.find((d) => d.type === actionType);
  if (!def) return null;

  const params: Record<string, any> = {};
  for (const p of def.params) {
    params[p.key] = p.default ?? '';
  }

  // Parse key="value" params
  for (let i = 1; i < words.length; i++) {
    const match = words[i].match(/^(\w+)="([^"]*)"$/);
    if (match) {
      const paramDef = def.params.find(p => p.key === match[1]);
      if (paramDef?.type === 'vector3') {
        const parts = match[2].split(',').map(Number);
        if (parts.length === 3) {
          params[match[1]] = { x: parts[0], y: parts[1], z: parts[2] };
        }
      } else if (paramDef?.type === 'number') {
        params[match[1]] = Number(match[2]);
      } else {
        params[match[1]] = match[2];
      }
    }
  }

  return {
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type: actionType,
    params,
    children: def.hasChildren ? [] : undefined,
    enabled: true,
  };
}

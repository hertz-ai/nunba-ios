/**
 * Game Registry - Maps template names to components and manages dynamic templates.
 *
 * Three rendering modes:
 * 1. Local Template: Uses built-in React Native template components (offline-capable)
 * 2. Server-Driven Native: Uses ServerDrivenUI with JSON layout from server (native feel)
 * 3. HTML5 Dynamic: Uses DynamicGameRenderer with server-generated HTML5 games (online)
 *
 * Dynamic templates from the server are cached in AsyncStorage and registered here
 * alongside the built-in 15 templates.
 */

// Lazy imports to avoid loading all templates at startup
const TEMPLATE_REGISTRY = {
  'multiple-choice': () => require('../templates/MultipleChoiceTemplate').default,
  'drag-to-zone': () => require('../templates/DragToZoneTemplate').default,
  'match-pairs': () => require('../templates/MatchPairsTemplate').default,
  'sequence-order': () => require('../templates/SequenceOrderTemplate').default,
  'word-build': () => require('../templates/WordBuildTemplate').default,
  'fill-blank': () => require('../templates/FillBlankTemplate').default,
  'memory-flip': () => require('../templates/MemoryFlipTemplate').default,
  'true-false': () => require('../templates/TrueFalseTemplate').default,
  'counting': () => require('../templates/CountingTemplate').default,
  'tracing': () => require('../templates/TracingTemplate').default,
  'timed-rush': () => require('../templates/TimedRushTemplate').default,
  'puzzle-assemble': () => require('../templates/PuzzleAssembleTemplate').default,
  'story-builder': () => require('../templates/StoryBuilderTemplate').default,
  'simulation': () => require('../templates/SimulationTemplate').default,
  'spot-difference': () => require('../templates/SpotDifferenceTemplate').default,
};

// Dynamic templates registered at runtime from server definitions
const dynamicTemplateRegistry = {};

export const getTemplateComponent = (templateName) => {
  const loader = TEMPLATE_REGISTRY[templateName];
  if (loader) {
    return loader();
  }
  return null;
};

// Check if a game should use server rendering (HTML5 WebView or server-driven native)
export const isServerGame = (gameConfig) => {
  return !!(gameConfig.serverHtml || gameConfig.serverUrl || gameConfig.serverLayout || gameConfig.dynamicTemplate);
};

// Check if a game uses a local built-in template
export const isLocalTemplate = (gameConfig) => {
  return gameConfig.template && TEMPLATE_REGISTRY[gameConfig.template] && !isServerGame(gameConfig);
};

// Register a dynamic template definition from the server
export const registerDynamicTemplate = (templateId, templateDef) => {
  dynamicTemplateRegistry[templateId] = {
    ...templateDef,
    registeredAt: Date.now(),
  };
};

// Get a dynamic template definition
export const getDynamicTemplate = (templateId) => {
  return dynamicTemplateRegistry[templateId] || null;
};

// Get all dynamic template IDs
export const getDynamicTemplateNames = () => {
  return Object.keys(dynamicTemplateRegistry);
};

// All built-in template names
export const TEMPLATE_NAMES = Object.keys(TEMPLATE_REGISTRY);

// All template names (built-in + dynamic)
export const getAllTemplateNames = () => {
  return [...TEMPLATE_NAMES, ...getDynamicTemplateNames()];
};

export default TEMPLATE_REGISTRY;

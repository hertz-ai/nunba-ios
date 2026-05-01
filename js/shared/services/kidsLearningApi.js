import { getUserAuthHeaders, getUserId } from './apiHelpers';
import { getApiBaseUrl } from './endpointResolver';

const post = async (path, body) => {
  const headers = await getUserAuthHeaders();
  const base = await getApiBaseUrl();
  const response = await fetch(`${base}/${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${path}`);
  }
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON response from ${path}`);
  }
};

const generateConversationId = () => {
  return 'kids-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
};

export const kidsLearningApi = {
  // Get adaptive question from TeachMe API
  getAdaptiveQuestion: async ({category, topic, age, difficulty, threeRType}) => {
    const userId = await getUserId();
    return post('chat/teachme2', {
      text: [`Generate a ${category} question about ${topic} for age ${age}, difficulty ${difficulty}, focus on ${threeRType}`],
      raw_text: `${category} question: ${topic}`,
      user_id: userId,
      goals: {
        name: 'kids_learning',
        text: `${category} - ${topic}`,
        scope: 'kids_game',
      },
      conversation_id: generateConversationId(),
    });
  },

  // Get assessment-style question
  getAssessmentQuestion: async ({category, topic, age}) => {
    const userId = await getUserId();
    return post('chat/assessments', {
      text: [`Kids assessment: ${category} - ${topic} for age ${age}`],
      raw_text: `assessment: ${category} ${topic}`,
      user_id: userId,
      conversation_id: generateConversationId(),
    });
  },

  // Create a game dynamically from natural language prompt
  createGameFromPrompt: async (prompt, ageGroup) => {
    const userId = await getUserId();
    return post('chat/custom_gpt', {
      text: [
        `You are a kids educational game designer. Create a game configuration JSON for this request: "${prompt}". ` +
        `Target age group: ${ageGroup}. ` +
        `The JSON must have these fields: id (unique string), title, category (english|math|lifeSkills|science|creativity), ` +
        `subcategory, template (one of: multiple-choice, drag-to-zone, match-pairs, sequence-order, word-build, ` +
        `fill-blank, memory-flip, true-false, counting, tracing, timed-rush, puzzle-assemble, story-builder, simulation, spot-difference), ` +
        `ageRange [min, max], difficulty (1-5), icon (MaterialCommunityIcons name), color (hex), ` +
        `estimatedMinutes, questionsPerSession, learningObjectives (array), tags (array), ` +
        `content (template-specific data with questions/items), ` +
        `rewards {starsPerCorrect, bonusThreshold, bonusStars}. ` +
        `Return ONLY valid JSON, no explanation.`,
      ],
      raw_text: prompt,
      user_id: userId,
      goals: {
        name: 'kids_game_creator',
        text: prompt,
        scope: 'game_generation',
      },
      conversation_id: generateConversationId(),
    });
  },

  // Report game completion for server-side tracking
  reportGameCompletion: async (result) => {
    const userId = await getUserId();
    return post('chat/teachme2', {
      text: [`Game completed: ${JSON.stringify(result)}`],
      raw_text: 'game_completion',
      user_id: userId,
      goals: {
        name: 'kids_learning_progress',
        text: `Completed ${result.gameTitle} - Score: ${result.score}`,
        scope: 'progress_report',
      },
      conversation_id: generateConversationId(),
    });
  },

  // Sync pending offline results
  syncResults: async (results) => {
    const userId = await getUserId();
    return post('chat/teachme2', {
      text: [`Batch sync: ${JSON.stringify(results)}`],
      raw_text: 'batch_sync',
      user_id: userId,
      goals: {
        name: 'kids_learning_sync',
        text: `Syncing ${results.length} game results`,
        scope: 'batch_sync',
      },
      conversation_id: generateConversationId(),
    });
  },

  // ── Dynamic Backend Compute ──

  // Create a dynamic template from natural language
  // Server returns a template definition with serverLayout (JSON UI DSL)
  // or serverHtml (HTML5 game) or a standard template config
  createDynamicTemplate: async (prompt, options = {}) => {
    const userId = await getUserId();
    return post('chat/custom_gpt', {
      text: [
        `You are a kids educational game template designer. Create a new game template for: "${prompt}". ` +
        `The template should be a reusable game mechanic (not a specific game). ` +
        `Return JSON with: templateId (unique slug), title, description, mechanic (how the game works), ` +
        `renderMode ("server-driven" for native UI layout, or "html5" for full HTML game), ` +
        `and either: ` +
        `(A) serverLayout: a JSON UI tree using types: view, text, button, icon, row, column, grid, ` +
        `card, input, option-button, progress-dots, timer-bar, number-pad, animated, loop, conditional. ` +
        `Nodes can have: type, props, style (preset name), children, bind (data path), action (callback name), visible (condition). ` +
        `Style presets: title, subtitle, body, caption, instruction, display, correct, incorrect, ` +
        `centered, padded, row, column, card, cardAccent, chip, primaryBtn, secondaryBtn, questionCard, optionGrid. ` +
        `(B) serverHtml: complete self-contained HTML5 game string using window.KidsGameBridge API ` +
        `(reportAnswer(correct, concept, timeMs), reportComplete(score, correct, total), reportReady()). ` +
        `Also include: contentSchema (JSON schema describing what content this template expects), ` +
        `defaultContent (sample content for preview), category tags. ` +
        `Return ONLY valid JSON.`,
      ],
      raw_text: prompt,
      user_id: userId,
      goals: {
        name: 'kids_template_creator',
        text: prompt,
        scope: 'template_generation',
      },
      conversation_id: generateConversationId(),
      ...(options.threeRData && {context: {threeR: options.threeRData}}),
    });
  },

  // Evolve an existing game - server modifies difficulty, content, or mechanics
  evolveGame: async (gameConfig, evolutionType, studentData = {}) => {
    const userId = await getUserId();
    return post('chat/custom_gpt', {
      text: [
        `You are a kids game evolution agent. Evolve this game based on student performance. ` +
        `Current game: ${JSON.stringify({id: gameConfig.id, title: gameConfig.title, template: gameConfig.template, difficulty: gameConfig.difficulty, category: gameConfig.category})}. ` +
        `Evolution type: "${evolutionType}" (one of: harder, easier, more-content, different-mechanic, personalize). ` +
        `Student data: ${JSON.stringify(studentData)}. ` +
        `Return a complete updated game config JSON (same schema as original, with modified content/difficulty). ` +
        `If evolution type is "different-mechanic", you may change the template type or return serverHtml/serverLayout for a completely new mechanic. ` +
        `Return ONLY valid JSON.`,
      ],
      raw_text: `Evolve ${gameConfig.title}: ${evolutionType}`,
      user_id: userId,
      goals: {
        name: 'kids_game_evolution',
        text: `${evolutionType}: ${gameConfig.title}`,
        scope: 'game_evolution',
      },
      conversation_id: generateConversationId(),
    });
  },

  // Get a dynamic UI layout from server (for custom screens, dashboards, etc.)
  getDynamicUI: async (screenType, context = {}) => {
    const userId = await getUserId();
    return post('chat/custom_gpt', {
      text: [
        `You are a kids learning UI designer. Generate a native UI layout for screen type: "${screenType}". ` +
        `Context: ${JSON.stringify(context)}. ` +
        `Return a JSON UI tree using types: view, text, button, icon, row, column, grid, scroll, ` +
        `card, spacer, divider, animated, image, loop, conditional. ` +
        `Nodes: {type, props, style (preset name), children, bind (data path), action (callback), visible (condition)}. ` +
        `Style presets: title, subtitle, body, caption, instruction, display, centered, padded, paddedLg, ` +
        `row, rowSpaced, column, flex1, gap, gapSm, gapLg, card, cardAccent, chip, banner, ` +
        `primaryBtn, secondaryBtn, outlineBtn, btnText, btnTextDark, screenBg, questionCard, hintBanner. ` +
        `Color tokens start with $: $accent, $correct, $incorrect, $star, $textPrimary, $textSecondary, etc. ` +
        `Return ONLY valid JSON with a root layout node.`,
      ],
      raw_text: `UI: ${screenType}`,
      user_id: userId,
      goals: {
        name: 'kids_ui_generator',
        text: screenType,
        scope: 'ui_generation',
      },
      conversation_id: generateConversationId(),
      ...(context.threeRData && {context: {threeR: context.threeRData}}),
    });
  },

  // Create a complete game with dynamic UI (templates + content + UI in one call)
  createFullDynamicGame: async (prompt, options = {}) => {
    const userId = await getUserId();
    return post('chat/custom_gpt', {
      text: [
        `You are a kids educational game creator with full creative control. ` +
        `Create a complete game for: "${prompt}". ` +
        `Target age: ${options.ageGroup || '5-10'}. Category: ${options.category || 'auto-detect'}. ` +
        `You have THREE rendering options - choose the best one: ` +
        `1. TEMPLATE CONFIG: If the game fits an existing template, return {template: "template-name", content: {...}}. ` +
        `   Templates: multiple-choice, drag-to-zone, match-pairs, sequence-order, word-build, fill-blank, ` +
        `   memory-flip, true-false, counting, tracing, timed-rush, puzzle-assemble, story-builder, simulation, spot-difference. ` +
        `2. SERVER-DRIVEN NATIVE: For custom layouts with native feel, return {serverLayout: {type: "column", children: [...]}, content: {...}}. ` +
        `   Use UI types: view, text, button, icon, row, column, grid, card, input, option-button, ` +
        `   progress-dots, timer-bar, number-pad, animated, loop, conditional. ` +
        `3. HTML5 GAME: For complex interactive games, return {serverHtml: "<html>...</html>"}. ` +
        `   Use window.KidsGameBridge.reportAnswer(correct, concept, timeMs) and reportComplete(score, correct, total). ` +
        `Always include: id, title, category, difficulty (1-5), ageRange, icon, color, estimatedMinutes, ` +
        `questionsPerSession, learningObjectives, tags, rewards. ` +
        `Return ONLY valid JSON.`,
      ],
      raw_text: prompt,
      user_id: userId,
      goals: {
        name: 'kids_full_game_creator',
        text: prompt,
        scope: 'full_game_generation',
      },
      conversation_id: generateConversationId(),
    });
  },
};

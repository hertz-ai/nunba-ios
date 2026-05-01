// Kids Learning Zone - Barrel Export
export {default as KidsThemeProvider, useKidsTheme} from './KidsThemeProvider';
export {default as GameShell, useGameShell} from './GameShell';
export {default as GameHeader} from './GameHeader';
export {default as GameComplete} from './GameComplete';
export {default as StarReward} from './StarReward';
export {default as StreakFire} from './StreakFire';
export {default as OfflineBanner} from './OfflineBanner';
export {default as DynamicGameRenderer} from './DynamicGameRenderer';

// Dynamic Backend Compute
export {default as ServerDrivenUI, RenderNode, STYLE_PRESETS, resolveStyle, resolvePath} from './ServerDrivenUI';
export {default as DynamicTemplateEngine, getRenderMode, cacheDynamicTemplate, getCachedTemplate, clearTemplateCache} from './DynamicTemplateEngine';

// Shared interaction primitives
export {default as DragDropArea} from './shared/DragDropArea';
export {default as OptionButton} from './shared/OptionButton';
export {default as TimerBar} from './shared/TimerBar';
export {default as ProgressDots} from './shared/ProgressDots';
export {default as FeedbackOverlay} from './shared/FeedbackOverlay';
export {default as NumberPad} from './shared/NumberPad';
export {default as GameSounds, HapticPatterns, SoundEvents} from './shared/SoundManager';

// Media integration
export {default as AudioChannelManager} from './shared/AudioChannelManager';
export {default as MediaCacheManager} from './shared/MediaCacheManager';
export {default as TTSManager} from './shared/TTSManager';
export {default as MediaPreloader} from './shared/MediaPreloader';
export {default as KidsVideoPlayer} from './media/KidsVideoPlayer';
export {default as NarrationOverlay} from './media/NarrationOverlay';
export {default as MediaLoadingIndicator} from './media/MediaLoadingIndicator';

// Data
export {default as TEMPLATE_REGISTRY, getTemplateComponent, isServerGame, isLocalTemplate, TEMPLATE_NAMES, getAllTemplateNames, registerDynamicTemplate, getDynamicTemplate} from './data/gameRegistry';
export {default as GAME_CONFIGS, getGameById, getGamesByCategory, getGamesForAge, searchGames} from './data/gameConfigs';

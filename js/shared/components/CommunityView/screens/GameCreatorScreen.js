import React, {useState, useCallback} from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  SafeAreaView, StyleSheet, ActivityIndicator, Alert, NativeModules,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useNavigation} from '@react-navigation/native';
import * as Animatable from 'react-native-animatable';
import KidsThemeProvider from '../components/KidsLearning/KidsThemeProvider';
import useKidsLearningStore from '../../../kidsLearningStore';
import {kidsLearningApi} from '../../../services/kidsLearningApi';
import {TEMPLATE_NAMES} from '../components/KidsLearning/data/gameRegistry';
import {cacheDynamicTemplate} from '../components/KidsLearning/DynamicTemplateEngine';
import {
  kidsColors, kidsSpacing, kidsBorderRadius, kidsFontSize,
  kidsFontWeight, kidsShadows,
} from '../../../theme/kidsColors';

const CREATION_MODES = [
  {id: 'game', label: 'Create Game', icon: 'gamepad-variant', description: 'AI creates a complete game'},
  {id: 'template', label: 'Create Template', icon: 'puzzle', description: 'AI designs a new game mechanic'},
  {id: 'dynamic', label: 'Full Dynamic', icon: 'rocket-launch', description: 'AI builds custom HTML5 game'},
];

const SUGGESTED_PROMPTS = {
  game: [
    'Create a spelling game about animals for my 5 year old',
    'Math addition quiz with numbers up to 20',
    'Safety awareness game about road safety',
    'Vocabulary matching game about fruits and vegetables',
    'Counting game with farm animals',
    'True or false science facts about the solar system',
    'Story about being kind to others',
    'Daily routine ordering game for bedtime',
  ],
  template: [
    'A word scramble game where kids unscramble jumbled letters',
    'A rhythm tapping game that teaches counting beats',
    'A color mixing experiment where kids combine colors',
    'A map explorer game where kids navigate between landmarks',
    'A sentence builder where kids drag words into correct order',
    'A clock reading game with interactive hour/minute hands',
  ],
  dynamic: [
    'An interactive cooking game where kids follow recipe steps',
    'A virtual science lab with mixing chemicals',
    'A music creation game with drag-and-drop instruments',
    'A space exploration game with planets and facts',
    'A garden growing simulator with seasons and weather',
    'An interactive storybook with animated characters',
  ],
};

/**
 * GameCreatorScreen - Parents/teachers describe a game in natural language,
 * the server-side AI agent generates it. The generated game can be:
 * 1. A JSON config for a local template (fast, structured)
 * 2. A complete HTML5 game (flexible, any UI possible)
 *
 * The server agent decides the best approach, handles non-redundancy,
 * and evolves games over time.
 */
const GameCreatorScreen = () => {
  const navigation = useNavigation();
  const {ageGroup, addCustomGame} = useKidsLearningStore();
  const [prompt, setPrompt] = useState('');
  const [creationMode, setCreationMode] = useState('game');
  const [generating, setGenerating] = useState(false);
  const [generatedGame, setGeneratedGame] = useState(null);
  const [error, setError] = useState(null);

  // Parse server response into a game config regardless of format
  const parseResponse = useCallback((response) => {
    if (!response || typeof response !== 'object') return null;

    // Direct template-based game
    if (response.template && TEMPLATE_NAMES.includes(response.template)) {
      return {...response, id: response.id || `custom-${Date.now()}`, isCustom: true};
    }

    // Server-driven native layout
    if (response.serverLayout) {
      return {
        id: response.id || `sdn-${Date.now()}`,
        title: response.title || 'Dynamic Game',
        category: response.category || 'creativity',
        template: 'server-driven',
        serverLayout: response.serverLayout,
        content: response.content || response.defaultContent || {},
        difficulty: response.difficulty || 2,
        ageRange: response.ageRange || [4, 12],
        icon: response.icon || 'gamepad-variant',
        color: response.color || kidsColors.accent,
        estimatedMinutes: response.estimatedMinutes || 5,
        questionsPerSession: response.questionsPerSession || 10,
        isCustom: true,
      };
    }

    // Server-generated HTML5 game
    if (response.serverHtml || response.html) {
      return {
        id: `dynamic-${Date.now()}`,
        title: response.title || 'Custom Game',
        category: response.category || 'creativity',
        template: 'dynamic',
        serverHtml: response.serverHtml || response.html,
        difficulty: response.difficulty || 2,
        ageRange: response.ageRange || [4, 12],
        icon: response.icon || 'gamepad-variant',
        color: response.color || kidsColors.accent,
        estimatedMinutes: response.estimatedMinutes || 5,
        questionsPerSession: response.questionsPerSession || 10,
        isCustom: true,
      };
    }

    // Hosted game URL
    if (response.serverUrl || response.url) {
      return {
        id: `hosted-${Date.now()}`,
        title: response.title || 'Custom Game',
        category: response.category || 'creativity',
        template: 'dynamic',
        serverUrl: response.serverUrl || response.url,
        difficulty: response.difficulty || 2,
        ageRange: response.ageRange || [4, 12],
        icon: response.icon || 'gamepad-variant',
        color: response.color || kidsColors.accent,
        estimatedMinutes: response.estimatedMinutes || 5,
        questionsPerSession: response.questionsPerSession || 10,
        isCustom: true,
      };
    }

    // Text response - extract JSON or treat as HTML
    if (response.botMessage || response.text) {
      const text = response.botMessage || response.text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return parseResponse(parsed) || {...parsed, id: parsed.id || `custom-${Date.now()}`, isCustom: true};
        } catch (_) {
          // Invalid JSON in response - don't blindly treat as HTML game
          console.warn('[GameCreator] Failed to parse JSON from response');
          return null;
        }
      }
    }

    return null;
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setError(null);
    setGeneratedGame(null);

    try {
      let response;

      switch (creationMode) {
        case 'template':
          response = await kidsLearningApi.createDynamicTemplate(prompt.trim(), {ageGroup: ageGroup || 'middle'});
          // Cache template definition if it has a layout
          if (response?.templateId && response?.serverLayout) {
            await cacheDynamicTemplate(response.templateId, response);
          }
          break;

        case 'dynamic':
          response = await kidsLearningApi.createFullDynamicGame(prompt.trim(), {
            ageGroup: ageGroup || 'middle',
          });
          break;

        case 'game':
        default:
          response = await kidsLearningApi.createGameFromPrompt(prompt.trim(), ageGroup || 'middle');
          break;
      }

      const gameConfig = parseResponse(response);

      if (gameConfig) {
        setGeneratedGame(gameConfig);
      } else {
        setError('The AI agent is still learning to create this type of game. Try a different description.');
      }
    } catch (e) {
      setError('Could not connect to the game creation agent. Check your internet connection.');
    } finally {
      setGenerating(false);
    }
  }, [prompt, ageGroup, creationMode, parseResponse]);

  const handleSaveAndPlay = useCallback(() => {
    if (generatedGame) {
      addCustomGame(generatedGame);
      navigation.navigate('KidsGame', {gameConfig: generatedGame});
    }
  }, [generatedGame]);

  const handlePlayWithoutSaving = useCallback(() => {
    if (generatedGame) {
      navigation.navigate('KidsGame', {gameConfig: generatedGame});
    }
  }, [generatedGame]);

  const handleStartVoice = useCallback(() => {
    try {
      NativeModules.ActivityStarterModule.startSpeechListening();
    } catch (e) {
      Alert.alert('Voice', 'Voice input not available on this device');
    }
  }, []);

  return (
    <KidsThemeProvider>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Icon name="arrow-left" size={28} color={kidsColors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Create a Game</Text>
            <View style={{width: 40}} />
          </View>

          {/* Instruction */}
          <Animatable.View animation="fadeIn" style={styles.infoCard}>
            <Icon name="robot-excited" size={40} color={kidsColors.accent} />
            <Text style={styles.infoText}>
              Describe what you want and our AI will create it instantly!
              {'\n'}Games, templates, and custom UI - all dynamic.
            </Text>
          </Animatable.View>

          {/* Creation Mode Tabs */}
          <View style={styles.modeTabs}>
            {CREATION_MODES.map(mode => (
              <TouchableOpacity
                key={mode.id}
                style={[styles.modeTab, creationMode === mode.id && styles.modeTabActive]}
                onPress={() => setCreationMode(mode.id)}
              >
                <Icon
                  name={mode.icon}
                  size={18}
                  color={creationMode === mode.id ? kidsColors.textOnDark : kidsColors.accent}
                />
                <Text style={[styles.modeTabText, creationMode === mode.id && styles.modeTabTextActive]}>
                  {mode.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="Describe the game you want..."
              placeholderTextColor={kidsColors.textMuted}
              value={prompt}
              onChangeText={setPrompt}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <View style={styles.inputActions}>
              <TouchableOpacity onPress={handleStartVoice} style={styles.voiceBtn}>
                <Icon name="microphone" size={24} color={kidsColors.accent} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleGenerate}
                disabled={!prompt.trim() || generating}
                style={[styles.generateBtn, (!prompt.trim() || generating) && styles.generateBtnDisabled]}
              >
                {generating ? (
                  <ActivityIndicator size="small" color={kidsColors.textOnDark} />
                ) : (
                  <Icon name="creation" size={24} color={kidsColors.textOnDark} />
                )}
                <Text style={styles.generateText}>
                  {generating ? 'Creating...' : 'Create Game'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Suggested Prompts */}
          <Text style={styles.suggestTitle}>Try these ideas:</Text>
          <View style={styles.suggestGrid}>
            {(SUGGESTED_PROMPTS[creationMode] || SUGGESTED_PROMPTS.game).map((sp, i) => (
              <TouchableOpacity
                key={`${creationMode}-${i}`}
                style={styles.suggestChip}
                onPress={() => setPrompt(sp)}
              >
                <Text style={styles.suggestText} numberOfLines={2}>{sp}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Error */}
          {error && (
            <View style={styles.errorCard}>
              <Icon name="alert-circle" size={24} color={kidsColors.incorrect} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Generated Game Preview */}
          {generatedGame && (
            <Animatable.View animation="fadeInUp" style={styles.previewCard}>
              <View style={styles.previewHeader}>
                <Icon name="check-decagram" size={24} color={kidsColors.correct} />
                <Text style={styles.previewTitle}>Game Created!</Text>
              </View>
              <Text style={styles.previewName}>{generatedGame.title}</Text>
              <Text style={styles.previewMeta}>
                {generatedGame.category} | Difficulty: {generatedGame.difficulty || '?'}/5
                {generatedGame.serverHtml ? ' | HTML5 Dynamic' : ''}
                {generatedGame.serverLayout ? ' | Server-Driven Native' : ''}
                {generatedGame.dynamicTemplate ? ` | Dynamic Template: ${generatedGame.dynamicTemplate}` : ''}
                {generatedGame.template && !['dynamic', 'server-driven'].includes(generatedGame.template) ? ` | ${generatedGame.template}` : ''}
              </Text>

              <View style={styles.previewButtons}>
                <TouchableOpacity style={styles.playBtn} onPress={handlePlayWithoutSaving}>
                  <Icon name="play" size={20} color={kidsColors.textOnDark} />
                  <Text style={styles.playBtnText}>Try It</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.savePlayBtn} onPress={handleSaveAndPlay}>
                  <Icon name="content-save" size={20} color={kidsColors.textOnDark} />
                  <Text style={styles.savePlayBtnText}>Save & Play</Text>
                </TouchableOpacity>
              </View>
            </Animatable.View>
          )}
        </ScrollView>
      </SafeAreaView>
    </KidsThemeProvider>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: kidsColors.background},
  scroll: {paddingBottom: kidsSpacing.xxl},
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: kidsSpacing.md, paddingVertical: kidsSpacing.md,
  },
  backBtn: {padding: kidsSpacing.xs},
  headerTitle: {fontSize: kidsFontSize.xl, fontWeight: kidsFontWeight.extrabold, color: kidsColors.accent},
  infoCard: {
    flexDirection: 'row', alignItems: 'center', gap: kidsSpacing.md,
    backgroundColor: kidsColors.card, marginHorizontal: kidsSpacing.md,
    padding: kidsSpacing.md, borderRadius: kidsBorderRadius.lg, marginBottom: kidsSpacing.md,
    ...kidsShadows.card,
  },
  infoText: {flex: 1, fontSize: kidsFontSize.sm, color: kidsColors.textSecondary, lineHeight: 20},
  modeTabs: {
    flexDirection: 'row', gap: kidsSpacing.sm, paddingHorizontal: kidsSpacing.md,
    marginBottom: kidsSpacing.md,
  },
  modeTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: kidsSpacing.xs, paddingVertical: kidsSpacing.sm, paddingHorizontal: kidsSpacing.sm,
    borderRadius: kidsBorderRadius.lg, borderWidth: 2, borderColor: kidsColors.accent,
    backgroundColor: kidsColors.card,
  },
  modeTabActive: {
    backgroundColor: kidsColors.accent, borderColor: kidsColors.accent,
  },
  modeTabText: {
    fontSize: kidsFontSize.xs, fontWeight: kidsFontWeight.semibold, color: kidsColors.accent,
  },
  modeTabTextActive: {
    color: kidsColors.textOnDark,
  },
  inputContainer: {
    backgroundColor: kidsColors.card, marginHorizontal: kidsSpacing.md,
    borderRadius: kidsBorderRadius.lg, padding: kidsSpacing.md, marginBottom: kidsSpacing.md,
    ...kidsShadows.card,
  },
  textInput: {
    fontSize: kidsFontSize.md, color: kidsColors.textPrimary, minHeight: 100,
    borderWidth: 1, borderColor: kidsColors.border, borderRadius: kidsBorderRadius.md,
    padding: kidsSpacing.md,
  },
  inputActions: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: kidsSpacing.md,
  },
  voiceBtn: {
    padding: kidsSpacing.md, borderRadius: kidsBorderRadius.full,
    backgroundColor: kidsColors.accent + '15',
  },
  generateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: kidsSpacing.sm,
    backgroundColor: kidsColors.accent, paddingHorizontal: kidsSpacing.lg,
    paddingVertical: kidsSpacing.md, borderRadius: kidsBorderRadius.lg,
    ...kidsShadows.button,
  },
  generateBtnDisabled: {opacity: 0.5},
  generateText: {fontSize: kidsFontSize.md, fontWeight: kidsFontWeight.bold, color: kidsColors.textOnDark},
  suggestTitle: {
    fontSize: kidsFontSize.sm, fontWeight: kidsFontWeight.semibold, color: kidsColors.textSecondary,
    paddingHorizontal: kidsSpacing.md, marginBottom: kidsSpacing.sm,
  },
  suggestGrid: {
    flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: kidsSpacing.md, gap: kidsSpacing.sm,
    marginBottom: kidsSpacing.lg,
  },
  suggestChip: {
    backgroundColor: kidsColors.card, paddingHorizontal: kidsSpacing.md,
    paddingVertical: kidsSpacing.sm, borderRadius: kidsBorderRadius.full,
    borderWidth: 1, borderColor: kidsColors.border, maxWidth: '48%',
  },
  suggestText: {fontSize: kidsFontSize.xs, color: kidsColors.textSecondary},
  errorCard: {
    flexDirection: 'row', alignItems: 'center', gap: kidsSpacing.sm,
    backgroundColor: kidsColors.incorrectLight, marginHorizontal: kidsSpacing.md,
    padding: kidsSpacing.md, borderRadius: kidsBorderRadius.lg, marginBottom: kidsSpacing.md,
  },
  errorText: {flex: 1, fontSize: kidsFontSize.sm, color: kidsColors.incorrect},
  previewCard: {
    backgroundColor: kidsColors.card, marginHorizontal: kidsSpacing.md,
    padding: kidsSpacing.lg, borderRadius: kidsBorderRadius.xl,
    borderWidth: 2, borderColor: kidsColors.correct, ...kidsShadows.card,
  },
  previewHeader: {flexDirection: 'row', alignItems: 'center', gap: kidsSpacing.sm, marginBottom: kidsSpacing.md},
  previewTitle: {fontSize: kidsFontSize.lg, fontWeight: kidsFontWeight.bold, color: kidsColors.correct},
  previewName: {fontSize: kidsFontSize.xl, fontWeight: kidsFontWeight.extrabold, color: kidsColors.textPrimary, marginBottom: kidsSpacing.xs},
  previewMeta: {fontSize: kidsFontSize.xs, color: kidsColors.textSecondary, marginBottom: kidsSpacing.lg},
  previewButtons: {flexDirection: 'row', gap: kidsSpacing.md},
  playBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: kidsSpacing.sm,
    paddingVertical: kidsSpacing.md, borderRadius: kidsBorderRadius.lg,
    backgroundColor: kidsColors.accentSecondary, ...kidsShadows.button,
  },
  playBtnText: {fontSize: kidsFontSize.md, fontWeight: kidsFontWeight.bold, color: kidsColors.textOnDark},
  savePlayBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: kidsSpacing.sm,
    paddingVertical: kidsSpacing.md, borderRadius: kidsBorderRadius.lg,
    backgroundColor: kidsColors.accent, ...kidsShadows.button,
  },
  savePlayBtnText: {fontSize: kidsFontSize.md, fontWeight: kidsFontWeight.bold, color: kidsColors.textOnDark},
});

export default GameCreatorScreen;

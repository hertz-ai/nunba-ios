/**
 * AgentsHubScreen — RN equivalent of the Android Agents tab
 * (activity_learn_dark.xml + GridViewFragment.java).
 *
 * Layout parity (top→bottom):
 *   1. Search bar pill ("Search Agent")
 *   2. "Browse Goals" — horizontal scroll of user-goal avatars
 *   3. "Video Call With AI Agents" — horizontal scroll of three
 *      built-in personas (Teach Yourself / Revise With Your AI
 *      Friend / Quiz With Your Friend) → CustomBotChat with
 *      botId = 'ask_me' / 'revision' / 'assessment'
 *   4. "Your HevolveAI Agents" — horizontal scroll fetched from
 *      chatApi.getCustomBots(userId) → CustomBotChat with the
 *      bot's prompt_id
 *   5. "Create Agents" — CTA at bottom
 *
 * This is the surface that lets iOS reach the chat flows the Android
 * Java AbstractChatActivity subclasses serve.  Same colour scheme
 * (#0078FF blue accent on dark bg) to keep visual parity with the
 * existing Java surface.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  SafeAreaView, StatusBar, FlatList, Image, ActivityIndicator,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeModules } from 'react-native';
import { chatApi } from '../../../services/chatApi';

const BLUE = '#0078FF';
const BG   = '#000000';
const CARD = '#1A1F2E';

// Built-in personas — matches the Android RecyclerView items that
// historically launched AskMeChatActivity / RevisionChatActivity /
// AssessmentChatActivity respectively.  Same conversation_id values
// the server already understands.
const BUILTIN_AGENTS = [
  { id: 'ask_me',     name: 'Teach Yourself',           kind: 'teach',   tag: 'AskMe' },
  { id: 'revision',   name: 'Revise With Your AI Friend', kind: 'revise', tag: 'Revision' },
  { id: 'assessment', name: 'Quiz With Your Friend',    kind: 'quiz',    tag: 'Assess' },
];

// Goals row stub — mirrors the Android "Browse Goals" RecyclerView.
// Real implementation would fetch from /favorite_teacher_list or
// equivalent; for parity rendering we surface a placeholder until
// the goals endpoint is wired in a follow-up.
const PLACEHOLDER_GOALS = [
  { id: 'goal_default', name: 'Set a goal',  icon: 'add-circle-outline' },
];

const userIdOrZero = () => {
  try {
    const m = NativeModules?.ActivityStarterModule;
    if (m && typeof m.getUser_Id === 'function') {
      return Number(m.getUser_Id()) || 0;
    }
  } catch (_) {}
  return 0;
};

const BuiltinCard = ({ agent, onPress }) => (
  <TouchableOpacity
    style={styles.builtinCard}
    activeOpacity={0.8}
    accessibilityLabel={`Open ${agent.name}`}
    onPress={() => onPress(agent)}>
    <View style={styles.builtinIconWrap}>
      <Ionicons
        name={
          agent.kind === 'teach' ? 'school-outline' :
          agent.kind === 'revise' ? 'refresh-circle-outline' :
          'help-circle-outline'
        }
        size={36}
        color={BLUE}
      />
    </View>
    <Text style={styles.builtinLabel} numberOfLines={2}>{agent.name}</Text>
  </TouchableOpacity>
);

const CustomBotCard = ({ bot, onPress }) => (
  <TouchableOpacity
    style={styles.customCard}
    activeOpacity={0.8}
    accessibilityLabel={`Open ${bot.name || 'Custom bot'}`}
    onPress={() => onPress(bot)}>
    {bot.image_url ? (
      <Image source={{ uri: bot.image_url }} style={styles.customImage} />
    ) : bot.teacher_image_url ? (
      <Image source={{ uri: bot.teacher_image_url }} style={styles.customImage} />
    ) : (
      <View style={[styles.customImage, styles.customFallback]}>
        <Text style={styles.customFallbackLetter}>
          {(bot.name?.[0] || '?').toUpperCase()}
        </Text>
      </View>
    )}
    <Text style={styles.customLabel} numberOfLines={1}>{bot.name || 'Custom'}</Text>
  </TouchableOpacity>
);

const GoalAvatar = ({ goal, onPress }) => (
  <TouchableOpacity
    style={styles.goalAvatar}
    activeOpacity={0.8}
    accessibilityLabel={goal.name}
    onPress={() => onPress(goal)}>
    {goal.image ? (
      <Image source={{ uri: goal.image }} style={styles.goalImage} />
    ) : (
      <View style={[styles.goalImage, styles.goalFallback]}>
        <Ionicons name={goal.icon || 'person-outline'} size={28} color={BLUE} />
      </View>
    )}
  </TouchableOpacity>
);

const AgentsHubScreen = () => {
  const navigation = useNavigation();
  const [query, setQuery] = useState('');
  const [customBots, setCustomBots] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadCustomBots = useCallback(async () => {
    setLoading(true);
    try {
      const userId = userIdOrZero();
      const res = await chatApi.getCustomBots(userId);
      const list = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
      setCustomBots(list);
    } catch (_) {
      setCustomBots([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCustomBots(); }, [loadCustomBots]);

  const openBuiltin = (agent) => {
    navigation.navigate('CustomBotChat', {
      botId: agent.id,
      botName: agent.name,
      botImage: null,
    });
  };

  const openCustom = (bot) => {
    navigation.navigate('CustomBotChat', {
      botId: String(bot.prompt_id || bot.id || 'custom'),
      botName: bot.name || 'Custom Bot',
      botImage: bot.image_url || bot.teacher_image_url || null,
    });
  };

  const openCreate = () => {
    // Existing create-agent flow lives in CreateAgent / Persona Java
    // route on Android.  Until the RN port lands, just surface a
    // visible hook so the entry is discoverable on iOS.
    navigation.navigate('AgentInterview', { mode: 'create' });
  };

  // Client-side filter on bot list when the user types in search.
  const filteredBots = customBots.filter((b) =>
    !query || (b.name || '').toLowerCase().includes(query.toLowerCase()),
  );
  const filteredBuiltins = BUILTIN_AGENTS.filter((a) =>
    !query || a.name.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Search */}
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={BLUE} style={{ marginRight: 8 }} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search Agent"
            placeholderTextColor="#557"
            style={styles.searchInput}
          />
        </View>

        {/* Browse Goals */}
        <Text style={styles.sectionTitle}>Browse Goals</Text>
        <FlatList
          data={PLACEHOLDER_GOALS}
          horizontal
          keyExtractor={(it) => String(it.id)}
          contentContainerStyle={styles.hRow}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => <GoalAvatar goal={item} onPress={() => {}} />}
        />

        {/* Video Call With AI Agents — built-in personas */}
        <Text style={styles.sectionTitle}>Video Call With AI Agents</Text>
        <FlatList
          data={filteredBuiltins}
          horizontal
          keyExtractor={(it) => it.id}
          contentContainerStyle={styles.hRow}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => <BuiltinCard agent={item} onPress={openBuiltin} />}
        />

        {/* Your HevolveAI Agents — custom bot list */}
        <Text style={styles.sectionTitle}>Your HevolveAI Agents</Text>
        {loading ? (
          <ActivityIndicator size="small" color={BLUE} style={{ marginVertical: 12 }} />
        ) : filteredBots.length === 0 ? (
          <View style={styles.emptyRow}>
            <Text style={styles.emptyText}>No custom agents yet. Tap "Create Agents" below.</Text>
          </View>
        ) : (
          <FlatList
            data={filteredBots}
            horizontal
            keyExtractor={(b, i) => String(b.prompt_id || b.id || i)}
            contentContainerStyle={styles.hRow}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => <CustomBotCard bot={item} onPress={openCustom} />}
          />
        )}

        {/* Create Agents CTA */}
        <TouchableOpacity
          style={styles.createBtn}
          accessibilityLabel="Create Agents"
          onPress={openCreate}
          activeOpacity={0.85}>
          <Ionicons name="add-circle" size={22} color={BLUE} style={{ marginRight: 8 }} />
          <Text style={styles.createBtnText}>Create Agents</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scrollContent: { padding: wp('4%'), paddingBottom: hp('5%') },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0E1424',
    borderRadius: 24,
    paddingHorizontal: 14, paddingVertical: 8,
    marginBottom: hp('1.5%'),
    borderWidth: 1, borderColor: '#1B2840',
  },
  searchInput: {
    flex: 1, color: '#FFF', fontSize: wp('3.7%'),
    padding: 0, margin: 0,
  },
  sectionTitle: {
    color: BLUE, fontSize: wp('4.6%'), fontWeight: '700',
    marginTop: hp('1.5%'), marginBottom: hp('1%'),
  },
  hRow: { paddingHorizontal: 4, paddingVertical: 6, gap: 12 },
  goalAvatar: { marginRight: 12 },
  goalImage: { width: 60, height: 60, borderRadius: 30, backgroundColor: CARD },
  goalFallback: { justifyContent: 'center', alignItems: 'center' },
  builtinCard: {
    width: 110, height: 150,
    backgroundColor: CARD, borderRadius: 24,
    marginRight: 12,
    justifyContent: 'center', alignItems: 'center',
    padding: 10,
  },
  builtinIconWrap: { marginBottom: 10 },
  builtinLabel: {
    color: BLUE, fontWeight: '700', textAlign: 'center',
    fontSize: wp('3%'),
  },
  customCard: {
    width: 110, height: 150,
    backgroundColor: CARD, borderRadius: 24,
    marginRight: 12,
    overflow: 'hidden',
    justifyContent: 'flex-end', alignItems: 'center',
  },
  customImage: { width: 110, height: 110, resizeMode: 'cover' },
  customFallback: {
    backgroundColor: '#0E1424',
    justifyContent: 'center', alignItems: 'center',
  },
  customFallbackLetter: { color: BLUE, fontSize: 40, fontWeight: '700' },
  customLabel: {
    color: '#FFF', fontWeight: '600', textAlign: 'center',
    paddingVertical: 8, fontSize: wp('3%'),
  },
  emptyRow: { paddingVertical: 12 },
  emptyText: { color: '#888', fontSize: wp('3.3%') },
  createBtn: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center',
    marginTop: hp('2.5%'), paddingVertical: 14,
    borderRadius: 24, backgroundColor: '#0E1424',
    borderWidth: 1, borderColor: BLUE,
  },
  createBtnText: { color: BLUE, fontWeight: '700', fontSize: wp('4%') },
});

export default AgentsHubScreen;

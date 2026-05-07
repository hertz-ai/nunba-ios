/**
 * MCPToolBrowserScreen — RN parity for the web SPA's
 * landing-page/src/components/Social/Tools/MCPToolBrowser.jsx.
 *
 * Browse + discover MCP (Model Context Protocol) servers and tools.
 * Each server card shows: name, description, tool count, owner.
 * Tapping "View Tools" expands the card and lazy-loads the tool list
 * for that server.  Tapping a tool dispatches a `nunba:selectAgent`
 * DeviceEventEmitter event (RN-equivalent of the web custom-event)
 * that any chat composer screen can listen to.
 *
 * Backend (HARTOS — routes/api_mcp.py):
 *   GET /api/social/mcp/servers              — list registered MCP servers
 *   GET /api/social/mcp/servers/<id>/tools   — list tools on a server
 *
 * Service: services/socialApi.js → mcpApi.servers / mcpApi.tools.
 *
 * Web → RN translation notes:
 *   - MUI Card → bordered View with TouchableOpacity expand handle.
 *   - MUI Collapse → conditional render (no animation pod needed).
 *   - keyframes/animation/shimmer effects dropped (cosmetic).
 *   - `window.dispatchEvent('nunba:selectAgent')` →
 *     DeviceEventEmitter.emit('nunba:selectAgent') with same shape.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { mcpApi } from '../../../services/socialApi';

const ACCENT = '#6C63FF';
const ACCENT_GREEN = '#00e89d';
const MUTED = '#888';

const unwrap = (res) => {
  if (res && typeof res === 'object' && 'data' in res) return res.data;
  return res;
};

const MCPToolBrowserScreen = () => {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [toolsMap, setToolsMap] = useState({}); // serverId -> tools[]
  const [toolsLoading, setToolsLoading] = useState({});

  const fetchServers = useCallback(async () => {
    try {
      const res = await mcpApi.servers();
      const list = unwrap(res);
      setServers(Array.isArray(list) ? list : []);
    } catch (_) {
      setServers([]);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchServers();
      setLoading(false);
    })();
  }, [fetchServers]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchServers();
    setRefreshing(false);
  }, [fetchServers]);

  const filtered = useMemo(() => {
    if (!search.trim()) return servers;
    const q = search.toLowerCase();
    return servers.filter(
      (s) =>
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.description && s.description.toLowerCase().includes(q)) ||
        (s.owner && s.owner.toLowerCase().includes(q)),
    );
  }, [servers, search]);

  const handleToggle = useCallback(
    async (serverId) => {
      if (expandedId === serverId) {
        setExpandedId(null);
        return;
      }
      setExpandedId(serverId);
      if (!toolsMap[serverId]) {
        setToolsLoading((prev) => ({ ...prev, [serverId]: true }));
        try {
          const res = await mcpApi.tools(serverId);
          const list = unwrap(res);
          setToolsMap((prev) => ({
            ...prev,
            [serverId]: Array.isArray(list) ? list : [],
          }));
        } catch (_) {
          setToolsMap((prev) => ({ ...prev, [serverId]: [] }));
        } finally {
          setToolsLoading((prev) => ({ ...prev, [serverId]: false }));
        }
      }
    },
    [expandedId, toolsMap],
  );

  const handleUseInChat = useCallback((server, tool) => {
    // Web SPA dispatches a custom event on `window`; RN's analog is
    // DeviceEventEmitter so any composer screen can subscribe to it.
    DeviceEventEmitter.emit('nunba:selectAgent', {
      type: 'mcp_tool',
      serverId: server.id,
      serverName: server.name,
      toolName: tool.name,
      toolDescription: tool.description,
    });
  }, []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={ACCENT_GREEN}
        />
      }
      testID="mcp-tool-browser-screen"
    >
      <Text style={styles.heading}>MCP Tool Browser</Text>
      <Text style={styles.subtle}>
        Browse Model Context Protocol servers and tools registered with
        HARTOS.  Tap a tool to use it in your next chat.
      </Text>

      <View style={styles.searchRow}>
        <MaterialIcons
          name="search"
          size={18}
          color={MUTED}
          style={{ marginRight: 6 }}
        />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search servers, tools, or owners…"
          placeholderTextColor={MUTED}
          autoCapitalize="none"
          autoCorrect={false}
          testID="mcp-search-input"
        />
      </View>

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ACCENT_GREEN} />
        </View>
      )}

      {!loading && filtered.length === 0 && (
        <View style={[styles.card, styles.emptyCard]} testID="mcp-empty">
          <MaterialIcons
            name="build"
            size={32}
            color={MUTED}
            style={{ marginBottom: 8 }}
          />
          <Text style={styles.emptyTitle}>
            {search
              ? 'No servers match your search'
              : 'No MCP servers registered yet'}
          </Text>
          <Text style={styles.emptyBody}>
            {search
              ? 'Try a different search term.'
              : 'Register an MCP server to share tools with the community.'}
          </Text>
        </View>
      )}

      {!loading &&
        filtered.map((server) => {
          const isExpanded = expandedId === server.id;
          const tools = toolsMap[server.id] || [];
          const isLoadingTools = !!toolsLoading[server.id];
          return (
            <View
              key={server.id}
              style={styles.card}
              testID={`mcp-server-${server.id}`}
            >
              <Text style={styles.cardTitle}>{server.name}</Text>
              {!!server.description && (
                <Text style={styles.cardBody} numberOfLines={2}>
                  {server.description}
                </Text>
              )}
              <View style={styles.chipRow}>
                <View style={styles.chip}>
                  <MaterialIcons name="build" size={12} color={ACCENT} />
                  <Text style={styles.chipText}>
                    {server.tool_count || 0} tools
                  </Text>
                </View>
                {!!server.owner && (
                  <View style={[styles.chip, styles.chipMuted]}>
                    <MaterialIcons name="person" size={12} color={MUTED} />
                    <Text style={[styles.chipText, { color: MUTED }]}>
                      {server.owner}
                    </Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                onPress={() => handleToggle(server.id)}
                style={styles.expandRow}
                accessibilityRole="button"
                accessibilityLabel={
                  isExpanded
                    ? `Hide tools for ${server.name}`
                    : `View tools for ${server.name}`
                }
                testID={`mcp-toggle-${server.id}`}
              >
                <Text style={styles.expandText}>
                  {isExpanded ? 'Hide Tools' : 'View Tools'}
                </Text>
                <MaterialIcons
                  name={isExpanded ? 'expand-less' : 'expand-more'}
                  size={18}
                  color={ACCENT}
                />
              </TouchableOpacity>
              {isExpanded && (
                <View style={styles.toolsWrap}>
                  {isLoadingTools && (
                    <View style={styles.center}>
                      <ActivityIndicator size="small" color={ACCENT} />
                    </View>
                  )}
                  {!isLoadingTools && tools.length === 0 && (
                    <Text style={styles.emptyBody}>No tools available.</Text>
                  )}
                  {!isLoadingTools &&
                    tools.map((tool) => (
                      <View
                        key={tool.name}
                        style={styles.toolRow}
                        testID={`mcp-tool-${server.id}-${tool.name}`}
                      >
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={styles.toolName}>{tool.name}</Text>
                          {!!tool.description && (
                            <Text style={styles.toolDesc} numberOfLines={3}>
                              {tool.description}
                            </Text>
                          )}
                        </View>
                        <TouchableOpacity
                          onPress={() => handleUseInChat(server, tool)}
                          style={styles.iconButton}
                          accessibilityRole="button"
                          accessibilityLabel={`Use ${tool.name} in chat`}
                          testID={`mcp-use-${server.id}-${tool.name}`}
                        >
                          <MaterialIcons
                            name="chat-bubble-outline"
                            size={18}
                            color={ACCENT}
                          />
                        </TouchableOpacity>
                      </View>
                    ))}
                </View>
              )}
            </View>
          );
        })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  content: { padding: wp('4%') },
  heading: {
    color: '#FFF',
    fontSize: wp('5%'),
    fontWeight: '700',
    marginBottom: hp('0.6%'),
  },
  subtle: { color: MUTED, fontSize: wp('3.2%'), marginBottom: hp('1.5%') },
  center: { paddingVertical: hp('3%'), alignItems: 'center' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a3e',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('0.4%'),
    marginBottom: hp('1.5%'),
  },
  searchInput: {
    flex: 1,
    color: '#FFF',
    fontSize: wp('3.4%'),
    paddingVertical: hp('1%'),
  },
  card: {
    backgroundColor: '#2a2a3e',
    borderRadius: 12,
    padding: wp('4%'),
    marginBottom: hp('1.5%'),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  emptyCard: { alignItems: 'center', paddingVertical: hp('5%') },
  emptyTitle: {
    color: '#FFF',
    fontSize: wp('3.8%'),
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  emptyBody: {
    color: MUTED,
    fontSize: wp('3%'),
    textAlign: 'center',
  },
  cardTitle: {
    color: '#FFF',
    fontSize: wp('4%'),
    fontWeight: '700',
    marginBottom: 4,
  },
  cardBody: {
    color: MUTED,
    fontSize: wp('3.2%'),
    lineHeight: wp('4.4%'),
    marginBottom: 8,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(108,99,255,0.12)',
    borderColor: 'rgba(108,99,255,0.28)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    gap: 4,
  },
  chipMuted: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  chipText: {
    color: ACCENT,
    fontSize: wp('2.8%'),
    fontWeight: '600',
  },
  expandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: hp('0.5%'),
    paddingHorizontal: wp('1%'),
    marginTop: 4,
  },
  expandText: {
    color: ACCENT,
    fontSize: wp('3.2%'),
    fontWeight: '600',
    marginRight: 4,
  },
  toolsWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
    marginTop: hp('1%'),
    paddingTop: hp('1%'),
  },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: hp('0.7%'),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  toolName: {
    color: '#FFF',
    fontSize: wp('3.4%'),
    fontWeight: '600',
    marginBottom: 2,
  },
  toolDesc: {
    color: MUTED,
    fontSize: wp('2.9%'),
    lineHeight: wp('4%'),
  },
  iconButton: { padding: 6 },
});

export default MCPToolBrowserScreen;

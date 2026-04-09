// Mobile equivalent of components/chat/ChatWindow.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/authContext';
import { getMessages, sendMessage, subscribeToMessages } from '@/app/actions/messages';
import { Colors } from '@/constants/colors';
import type { Message } from '@/types';

interface Props {
  jobId: string;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ChatWindow({ jobId }: Props) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [text,     setText]     = useState('');
  const [sending,  setSending]  = useState(false);
  const listRef   = useRef<FlatList>(null);
  const sentIds   = useRef<Set<string>>(new Set()); // track IDs we sent to avoid realtime dupe

 useEffect(() => {
    let unsubFn: (() => void) | null = null;

    getMessages(jobId)
      .then((msgs) => {
        setMessages(msgs);
        msgs.forEach((m) => sentIds.current.add(m.id));
      })
      .catch(console.warn)
      .finally(() => setLoading(false));

    unsubFn = subscribeToMessages(jobId, (msg) => {
      if (sentIds.current.has(msg.id)) return;
      sentIds.current.add(msg.id);
      setMessages((prev) => [...prev, msg]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    });

    return () => {
      if (unsubFn) unsubFn();
    };
  }, [jobId]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 150);
    }
  }, [messages.length]);

  async function handleSend() {
    if (!text.trim() || !user) return;
    const content = text.trim();
    setText('');
    setSending(true);
    try {
      const msg = await sendMessage(jobId, content);
      // Track this ID so realtime doesn't add it again
      sentIds.current.add(msg.id);
      setMessages((prev) => [...prev, msg]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      console.warn(e);
      setText(content); // restore on fail
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={st.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={80}
    >
      {/* Header */}
      <View style={st.header}>
        <Ionicons name="chatbubbles-outline" size={18} color={Colors.blue600} />
        <Text style={st.headerTitle}>Job Chat</Text>
      </View>

      {/* Messages */}
      {loading ? (
        <View style={st.center}>
          <ActivityIndicator color={Colors.blue600} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={st.messageList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={st.emptyWrap}>
              <Ionicons name="chatbubble-ellipses-outline" size={36} color={Colors.text3} />
              <Text style={st.emptyText}>No messages yet. Start the conversation!</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isOwn = item.sender_id === user?.id;
            return (
              <View style={[st.msgRow, isOwn && st.msgRowOwn]}>
                {!isOwn && (
                  <View style={st.avatar}>
                    <Text style={st.avatarText}>
                      {(item.profiles?.full_name ?? 'U').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={[st.bubble, isOwn && st.bubbleOwn]}>
                  {!isOwn && item.profiles?.full_name && (
                    <Text style={st.senderName}>{item.profiles.full_name}</Text>
                  )}
                  <Text style={[st.msgText, isOwn && st.msgTextOwn]}>{item.content}</Text>
                  <Text style={[st.msgTime, isOwn && st.msgTimeOwn]}>
                    {formatTime(item.created_at)}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Input */}
      <View style={st.inputRow}>
        <TextInput
          style={st.input}
          placeholder="Type a message…"
          placeholderTextColor={Colors.text3}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[st.sendBtn, (!text.trim() || sending) && st.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!text.trim() || sending}
        >
          {sending
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="send" size={18} color="#fff" />
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  headerTitle: { fontSize: 15, fontWeight: '700', color: Colors.text1 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  messageList: { padding: 14, gap: 12, flexGrow: 1 },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 40 },
  emptyText: { fontSize: 14, color: Colors.text3, textAlign: 'center' },

  msgRow:    { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  msgRowOwn: { flexDirection: 'row-reverse' },

  avatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.blue100,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 12, fontWeight: '700', color: Colors.blue700 },

  bubble: {
    maxWidth: '75%',
    backgroundColor: Colors.surface2,
    borderRadius: 16, borderBottomLeftRadius: 4,
    padding: 10, gap: 3,
  },
  bubbleOwn: {
    backgroundColor: Colors.blue600,
    borderBottomLeftRadius: 16, borderBottomRightRadius: 4,
  },
  senderName: { fontSize: 11, fontWeight: '700', color: Colors.blue600, marginBottom: 2 },
  msgText:    { fontSize: 14, color: Colors.text1, lineHeight: 20 },
  msgTextOwn: { color: '#fff' },
  msgTime:    { fontSize: 10, color: Colors.text3, alignSelf: 'flex-end' },
  msgTimeOwn: { color: 'rgba(255,255,255,0.65)' },

  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    padding: 12, borderTopWidth: 1, borderTopColor: Colors.divider,
    backgroundColor: Colors.surface,
  },
  input: {
    flex: 1, backgroundColor: Colors.surface2, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.divider,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: Colors.text1, maxHeight: 100,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.blue600,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
});
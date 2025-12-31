import { useEffect, useRef } from "react";
import { FlatList, Text, View, KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenContainer } from "@/components/screen-container";
import { MessageBubble } from "@/components/message-bubble";
import { ChatInput } from "@/components/chat-input";
import { useChat } from "@/lib/chat-context";
import { useColors } from "@/hooks/use-colors";
import { ChatMessage } from "@/lib/types";

const QUICK_ACTIONS = [
  "مرحباً، كيف يمكنك مساعدتي؟",
  "اكتب لي رسالة بريد إلكتروني",
  "ساعدني في تنظيم أفكاري",
  "ما هي قدراتك؟",
];

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { state, sendMessage, loadMessages } = useChat();
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (state.messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [state.messages]);

  const renderMessage = ({ item }: { item: ChatMessage }) => (
    <MessageBubble message={item} />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.welcomeTitle, { color: colors.foreground }]}>
        السكرتير الذكي
      </Text>
      <Text style={[styles.welcomeSubtitle, { color: colors.muted }]}>
        مرحباً! أنا مساعدك الذكي. كيف يمكنني مساعدتك اليوم؟
      </Text>
      <View style={styles.quickActions}>
        {QUICK_ACTIONS.map((action, index) => (
          <View
            key={index}
            style={[styles.quickActionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text
              style={[styles.quickActionText, { color: colors.foreground }]}
              onPress={() => sendMessage(action)}
            >
              {action}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            السكرتير الذكي
          </Text>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={state.messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.messageList,
            state.messages.length === 0 && styles.emptyList,
          ]}
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
        />

        {/* Input */}
        <ChatInput onSend={sendMessage} disabled={state.isLoading} />
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  messageList: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  emptyList: {
    flex: 1,
    justifyContent: "center",
  },
  emptyContainer: {
    alignItems: "center",
    paddingHorizontal: 24,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 32,
  },
  quickActions: {
    width: "100%",
    gap: 12,
  },
  quickActionButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  quickActionText: {
    fontSize: 14,
    textAlign: "center",
  },
});

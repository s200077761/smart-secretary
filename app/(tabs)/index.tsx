import { useEffect, useRef, useState, useCallback } from "react";
import { FlatList, Text, View, KeyboardAvoidingView, Platform, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ScreenContainer } from "@/components/screen-container";
import { MessageBubble } from "@/components/message-bubble";
import { ChatInput } from "@/components/chat-input";
import { useChat } from "@/lib/chat-context";
import { useColors } from "@/hooks/use-colors";
import { ChatMessage } from "@/lib/types";

const SETTINGS_KEY = "smart_secretary_settings";

const QUICK_ACTIONS = [
  "مرحباً، كيف يمكنك مساعدتي؟",
  "اكتب لي رسالة بريد إلكتروني",
  "ساعدني في تنظيم أفكاري",
  "ما هي قدراتك؟",
];

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state, sendMessage, loadMessages } = useChat();
  const flatListRef = useRef<FlatList>(null);
  const [hasGeminiKey, setHasGeminiKey] = useState<boolean | null>(null);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useFocusEffect(
    useCallback(() => {
      checkApiKey();
    }, [])
  );

  const checkApiKey = async () => {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      if (stored) {
        const settings = JSON.parse(stored);
        setHasGeminiKey(!!settings.geminiKey);
      } else {
        setHasGeminiKey(false);
      }
    } catch {
      setHasGeminiKey(false);
    }
  };

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
      {hasGeminiKey === false ? (
        /* Setup required banner */
        <View style={[styles.setupCard, { backgroundColor: "#4285F410", borderColor: "#4285F440" }]}>
          <Text style={[styles.setupIcon]}>🔑</Text>
          <Text style={[styles.setupTitle, { color: colors.foreground }]}>
            مرحباً بك في السكرتير الذكي!
          </Text>
          <Text style={[styles.setupSubtitle, { color: colors.muted }]}>
            للبدء، تحتاج إلى إضافة مفتاح Google Gemini API المجاني.
          </Text>
          <View style={[styles.setupSteps, { borderColor: colors.border }]}>
            <Text style={[styles.setupStep, { color: colors.muted }]}>
              ١. اذهب إلى aistudio.google.com/apikey
            </Text>
            <Text style={[styles.setupStep, { color: colors.muted }]}>
              ٢. أنشئ مفتاح API مجاني
            </Text>
            <Text style={[styles.setupStep, { color: colors.muted }]}>
              ٣. انسخه وأضفه في الإعدادات أدناه
            </Text>
          </View>
          <Pressable
            onPress={() => router.push("/(tabs)/settings")}
            style={[styles.setupButton, { backgroundColor: "#4285F4" }]}
          >
            <Text style={styles.setupButtonText}>⚙️ افتح الإعدادات وأضف المفتاح</Text>
          </Pressable>
          <Text style={[styles.setupNote, { color: colors.muted }]}>
            المفتاح مجاني تماماً من Google ويعمل مباشرة
          </Text>
        </View>
      ) : (
        /* Normal welcome state */
        <>
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
        </>
      )}
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
          {hasGeminiKey === false && (
            <Pressable
              onPress={() => router.push("/(tabs)/settings")}
              style={[styles.headerSetupBadge, { backgroundColor: "#ef444420" }]}
            >
              <Text style={[styles.headerSetupBadgeText, { color: "#ef4444" }]}>
                ⚠️ يحتاج إعداد
              </Text>
            </Pressable>
          )}
          {hasGeminiKey === true && (
            <View style={[styles.headerSetupBadge, { backgroundColor: "#22c55e20" }]}>
              <Text style={[styles.headerSetupBadgeText, { color: "#22c55e" }]}>
                ✓ جاهز
              </Text>
            </View>
          )}
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
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  headerSetupBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  headerSetupBadgeText: {
    fontSize: 11,
    fontWeight: "600",
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
  setupCard: {
    width: "100%",
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    gap: 12,
  },
  setupIcon: {
    fontSize: 40,
  },
  setupTitle: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  setupSubtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  setupSteps: {
    width: "100%",
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    paddingVertical: 12,
    gap: 6,
  },
  setupStep: {
    fontSize: 13,
    textAlign: "right",
    lineHeight: 20,
  },
  setupButton: {
    width: "100%",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  setupButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  setupNote: {
    fontSize: 12,
    textAlign: "center",
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

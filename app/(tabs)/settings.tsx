import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Switch,
  Alert,
  Platform,
  TextInput,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useChat } from "@/lib/chat-context";
import { AIProvider } from "@/lib/types";
import * as Haptics from "expo-haptics";

const SETTINGS_KEY = "smart_secretary_settings";

interface Settings {
  enableHaptics: boolean;
  responseStyle: "concise" | "detailed";
  aiProvider: AIProvider;
  geminiKey: string;
}

const defaultSettings: Settings = {
  enableHaptics: true,
  responseStyle: "detailed",
  aiProvider: "huggingface",
  geminiKey: "",
};

const AI_PROVIDERS: { id: AIProvider; label: string; labelAr: string; model: string }[] = [
  { id: "huggingface", label: "HuggingFace", labelAr: "HuggingFace", model: "Qwen2.5-7B" },
  { id: "openai", label: "OpenAI", labelAr: "OpenAI GPT", model: "GPT-4o mini" },
  { id: "anthropic", label: "Anthropic", labelAr: "Claude", model: "claude-haiku" },
  { id: "gemini", label: "Google Gemini", labelAr: "Gemini", model: "Gemini 2.0 Flash" },
];

const BOT_PLATFORMS = [
  { id: "telegram", label: "Telegram", labelAr: "تيليجرام", envVar: "TELEGRAM_TOKEN" },
  { id: "whatsapp", label: "WhatsApp", labelAr: "واتساب", envVar: "WHATSAPP_TOKEN" },
  { id: "discord", label: "Discord", labelAr: "ديسكورد", envVar: "DISCORD_BOT_TOKEN" },
];

export default function SettingsScreen() {
  const colors = useColors();
  const { clearMessages } = useChat();
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [showProviderPicker, setShowProviderPicker] = useState(false);
  const [geminiKeyInput, setGeminiKeyInput] = useState("");
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [geminiTestStatus, setGeminiTestStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [geminiTestMsg, setGeminiTestMsg] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({ ...defaultSettings, ...parsed });
        setGeminiKeyInput(parsed.geminiKey || "");
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  };

  const saveSettings = async (newSettings: Settings) => {
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  };

  const handleSaveGeminiKey = () => {
    saveSettings({ ...settings, geminiKey: geminiKeyInput.trim() });
    Alert.alert("تم الحفظ", geminiKeyInput.trim() ? "تم حفظ مفتاح Gemini بنجاح" : "تم مسح مفتاح Gemini");
  };

  const handleTestGemini = async () => {
    const key = geminiKeyInput.trim();
    if (!key) { Alert.alert("خطأ", "أدخل المفتاح أولاً"); return; }
    setGeminiTestStatus("loading");
    setGeminiTestMsg("جارٍ الاختبار...");
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: "قل: مرحبا" }] }], generationConfig: { maxOutputTokens: 10 } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Error ${res.status}`);
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "OK";
      setGeminiTestStatus("ok");
      setGeminiTestMsg(`✓ يعمل! الرد: ${reply.slice(0, 50)}`);
    } catch (e: unknown) {
      setGeminiTestStatus("error");
      setGeminiTestMsg(`✗ خطأ: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleToggleHaptics = () => {
    if (Platform.OS !== "web" && settings.enableHaptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    saveSettings({ ...settings, enableHaptics: !settings.enableHaptics });
  };

  const handleResponseStyleChange = () => {
    if (Platform.OS !== "web" && settings.enableHaptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const newStyle = settings.responseStyle === "concise" ? "detailed" : "concise";
    saveSettings({ ...settings, responseStyle: newStyle });
  };

  const handleProviderChange = (provider: AIProvider) => {
    if (Platform.OS !== "web" && settings.enableHaptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    saveSettings({ ...settings, aiProvider: provider });
    setShowProviderPicker(false);
  };

  const handleClearHistory = () => {
    Alert.alert(
      "مسح سجل المحادثات",
      "هل أنت متأكد من رغبتك في مسح جميع المحادثات؟ لا يمكن التراجع عن هذا الإجراء.",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "مسح",
          style: "destructive",
          onPress: async () => {
            await clearMessages();
            if (Platform.OS !== "web" && settings.enableHaptics) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            Alert.alert("تم", "تم مسح سجل المحادثات بنجاح");
          },
        },
      ]
    );
  };

  const currentProvider = AI_PROVIDERS.find((p) => p.id === settings.aiProvider) ?? AI_PROVIDERS[0];

  const renderSettingItem = ({
    icon,
    title,
    subtitle,
    rightElement,
    onPress,
    destructive,
  }: {
    icon: "moon" | "sparkles" | "trash" | "info.circle" | "globe" | "bolt" | "bubble.left";
    title: string;
    subtitle?: string;
    rightElement?: React.ReactNode;
    onPress?: () => void;
    destructive?: boolean;
  }) => (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.settingItem,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && onPress && { opacity: 0.7 },
      ]}
    >
      <View style={[styles.iconContainer, { backgroundColor: destructive ? colors.error + "20" : colors.primary + "20" }]}>
        <IconSymbol name={icon} size={20} color={destructive ? colors.error : colors.primary} />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, { color: destructive ? colors.error : colors.foreground }]}>
          {title}
        </Text>
        {subtitle && (
          <Text style={[styles.settingSubtitle, { color: colors.muted }]}>{subtitle}</Text>
        )}
      </View>
      {rightElement}
    </Pressable>
  );

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>الإعدادات</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {/* AI Settings Section */}
        <Text style={[styles.sectionTitle, { color: colors.muted }]}>إعدادات الذكاء الاصطناعي</Text>
        <View style={styles.section}>
          {renderSettingItem({
            icon: "sparkles",
            title: "أسلوب الرد",
            subtitle: settings.responseStyle === "concise" ? "موجز" : "مفصل",
            onPress: handleResponseStyleChange,
            rightElement: (
              <View style={[styles.badge, { backgroundColor: colors.primary + "20" }]}>
                <Text style={[styles.badgeText, { color: colors.primary }]}>
                  {settings.responseStyle === "concise" ? "موجز" : "مفصل"}
                </Text>
              </View>
            ),
          })}

          {/* AI Provider Selector */}
          {renderSettingItem({
            icon: "bolt",
            title: "مزود الذكاء الاصطناعي",
            subtitle: `${currentProvider.labelAr} · ${currentProvider.model}`,
            onPress: () => setShowProviderPicker(!showProviderPicker),
            rightElement: (
              <View style={[styles.badge, { backgroundColor: "#7C3AED20" }]}>
                <Text style={[styles.badgeText, { color: "#7C3AED" }]}>
                  {currentProvider.label}
                </Text>
              </View>
            ),
          })}

          {/* Provider Picker Dropdown */}
          {showProviderPicker && (
            <View style={[styles.providerPicker, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {AI_PROVIDERS.map((provider) => (
                <Pressable
                  key={provider.id}
                  onPress={() => handleProviderChange(provider.id)}
                  style={({ pressed }) => [
                    styles.providerOption,
                    { borderBottomColor: colors.border },
                    pressed && { opacity: 0.7 },
                    settings.aiProvider === provider.id && { backgroundColor: "#7C3AED15" },
                  ]}
                >
                  <View style={styles.providerOptionContent}>
                    <Text style={[styles.providerOptionTitle, { color: colors.foreground }]}>
                      {provider.labelAr}
                    </Text>
                    <Text style={[styles.providerOptionModel, { color: colors.muted }]}>
                      {provider.model}
                    </Text>
                  </View>
                  {settings.aiProvider === provider.id && (
                    <IconSymbol name="checkmark" size={16} color="#7C3AED" />
                  )}
                </Pressable>
              ))}
            </View>
          )}

          {/* Gemini key input — shown inline when Gemini is selected */}
          {settings.aiProvider === "gemini" && (
            <View style={{ marginTop: 12, padding: 12, backgroundColor: "#4285F410", borderRadius: 8 }}>
              <Text style={[styles.tokenHint, { color: colors.muted, marginBottom: 8 }]}>
                مفتاح Google Gemini API — احصل عليه مجاناً من aistudio.google.com/apikey
              </Text>
              <View style={styles.tokenInputRow}>
                <TextInput
                  style={[styles.tokenInput, { color: colors.foreground, borderColor: "#4285F440", backgroundColor: colors.background }]}
                  value={geminiKeyInput}
                  onChangeText={setGeminiKeyInput}
                  placeholder="AIzaSy..."
                  placeholderTextColor={colors.muted}
                  secureTextEntry={!showGeminiKey}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable
                  onPress={() => setShowGeminiKey(!showGeminiKey)}
                  style={[styles.tokenToggle, { backgroundColor: "#4285F420" }]}
                >
                  <Text style={[styles.tokenToggleText, { color: "#4285F4" }]}>
                    {showGeminiKey ? "إخفاء" : "إظهار"}
                  </Text>
                </Pressable>
              </View>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <Pressable
                  onPress={handleSaveGeminiKey}
                  style={[styles.tokenSaveButton, { backgroundColor: "#4285F4", flex: 1 }]}
                >
                  <Text style={styles.tokenSaveButtonText}>حفظ</Text>
                </Pressable>
                <Pressable
                  onPress={handleTestGemini}
                  style={[styles.tokenSaveButton, { backgroundColor: "#22c55e", flex: 1 }]}
                >
                  <Text style={styles.tokenSaveButtonText}>
                    {geminiTestStatus === "loading" ? "..." : "اختبار"}
                  </Text>
                </Pressable>
              </View>
              {geminiTestMsg ? (
                <Text style={{ color: geminiTestStatus === "ok" ? "#22c55e" : "#ef4444", fontSize: 12, marginTop: 6 }}>
                  {geminiTestMsg}
                </Text>
              ) : settings.geminiKey ? (
                <Text style={{ color: "#22c55e", fontSize: 12, marginTop: 6 }}>✓ تم حفظ المفتاح</Text>
              ) : null}
            </View>
          )}
        </View>

        {/* OpenClaw Messaging Platforms */}
        <Text style={[styles.sectionTitle, { color: colors.muted }]}>منصات المراسلة (OpenClaw)</Text>
        <View style={[styles.platformCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.platformCardTitle, { color: colors.foreground }]}>
            تكاملات البوت
          </Text>
          <Text style={[styles.platformCardSubtitle, { color: colors.muted }]}>
            فعّل البوتات عبر متغيرات البيئة في الخادم
          </Text>
          <View style={styles.platformList}>
            {BOT_PLATFORMS.map((platform) => (
              <View key={platform.id} style={styles.platformRow}>
                <View style={[styles.platformDot, { backgroundColor: colors.muted + "40" }]} />
                <Text style={[styles.platformName, { color: colors.foreground }]}>
                  {platform.labelAr}
                </Text>
                <Text style={[styles.platformEnv, { color: colors.muted }]}>
                  {platform.envVar}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Google Gemini API Key */}
        <Text style={[styles.sectionTitle, { color: colors.muted }]}>مفتاح Google Gemini API (مجاني)</Text>
        <View style={[styles.tokenCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.tokenHint, { color: colors.muted }]}>
            احصل على مفتاح مجاني من: aistudio.google.com/apikey
          </Text>
          <View style={styles.tokenInputRow}>
            <TextInput
              style={[styles.tokenInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              value={geminiKeyInput}
              onChangeText={setGeminiKeyInput}
              placeholder="AIza..."
              placeholderTextColor={colors.muted}
              secureTextEntry={!showGeminiKey}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable
              onPress={() => setShowGeminiKey(!showGeminiKey)}
              style={[styles.tokenToggle, { backgroundColor: "#4285F420" }]}
            >
              <Text style={[styles.tokenToggleText, { color: "#4285F4" }]}>
                {showGeminiKey ? "إخفاء" : "إظهار"}
              </Text>
            </Pressable>
          </View>
          <Pressable
            onPress={handleSaveGeminiKey}
            style={[styles.tokenSaveButton, { backgroundColor: "#4285F4" }]}
          >
            <Text style={styles.tokenSaveButtonText}>حفظ مفتاح Gemini</Text>
          </Pressable>
        </View>

                        {/* App Settings Section */}
        <Text style={[styles.sectionTitle, { color: colors.muted }]}>إعدادات التطبيق</Text>
        <View style={styles.section}>
          {renderSettingItem({
            icon: "moon",
            title: "الاهتزاز اللمسي",
            subtitle: "تفعيل الاهتزاز عند التفاعل",
            rightElement: (
              <Switch
                value={settings.enableHaptics}
                onValueChange={handleToggleHaptics}
                trackColor={{ false: colors.border, true: colors.primary + "80" }}
                thumbColor={settings.enableHaptics ? colors.primary : colors.muted}
              />
            ),
          })}
        </View>

        {/* Data Section */}
        <Text style={[styles.sectionTitle, { color: colors.muted }]}>البيانات</Text>
        <View style={styles.section}>
          {renderSettingItem({
            icon: "trash",
            title: "مسح سجل المحادثات",
            subtitle: "حذف جميع المحادثات السابقة",
            onPress: handleClearHistory,
            destructive: true,
          })}
        </View>

        {/* About Section */}
        <Text style={[styles.sectionTitle, { color: colors.muted }]}>حول التطبيق</Text>
        <View style={styles.section}>
          {renderSettingItem({
            icon: "info.circle",
            title: "السكرتير الذكي",
            subtitle: "الإصدار 2.1.0",
          })}
        </View>

        {/* App Description */}
        <View style={[styles.descriptionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.descriptionTitle, { color: colors.foreground }]}>
            السكرتير الذكي
          </Text>
          <Text style={[styles.descriptionText, { color: colors.muted }]}>
            مساعدك الذكي الشخصي للمهام اليومية. يوفر التطبيق خدمات الدردشة الذكية، الوكلاء المتخصصين، البحث المعزز بالذكاء الاصطناعي، ومساعد الكود البرمجي.
          </Text>
          <Text style={[styles.descriptionText, { color: colors.muted, marginTop: 8 }]}>
            مدعوم بتكاملات OpenClaw: Telegram · WhatsApp · Discord
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
    marginTop: 16,
    textAlign: "right",
    textTransform: "uppercase",
  },
  section: {
    gap: 8,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: "500",
    textAlign: "right",
  },
  settingSubtitle: {
    fontSize: 13,
    marginTop: 2,
    textAlign: "right",
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  providerPicker: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    marginTop: 4,
  },
  providerOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 0.5,
    gap: 12,
  },
  providerOptionContent: {
    flex: 1,
    alignItems: "flex-end",
  },
  providerOptionTitle: {
    fontSize: 15,
    fontWeight: "500",
    textAlign: "right",
  },
  providerOptionModel: {
    fontSize: 12,
    marginTop: 2,
    textAlign: "right",
  },
  platformCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  platformCardTitle: {
    fontSize: 15,
    fontWeight: "600",
    textAlign: "right",
  },
  platformCardSubtitle: {
    fontSize: 13,
    textAlign: "right",
  },
  platformList: {
    gap: 8,
    marginTop: 4,
  },
  platformRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "flex-end",
  },
  platformDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  platformName: {
    fontSize: 14,
    fontWeight: "500",
  },
  platformEnv: {
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    backgroundColor: "rgba(0,0,0,0.06)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tokenCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  tokenHint: {
    fontSize: 12,
    textAlign: "right",
    lineHeight: 18,
  },
  tokenInputRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  tokenInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    textAlign: "left",
  },
  tokenToggle: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  tokenToggleText: {
    fontSize: 12,
    fontWeight: "600",
  },
  tokenSaveButton: {
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  tokenSaveButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  descriptionCard: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  descriptionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
});

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
}

const defaultSettings: Settings = {
  enableHaptics: true,
  responseStyle: "detailed",
  aiProvider: "huggingface",
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

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      if (stored) {
        setSettings({ ...defaultSettings, ...JSON.parse(stored) });
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

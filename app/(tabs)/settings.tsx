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
import * as Haptics from "expo-haptics";

const SETTINGS_KEY = "smart_secretary_settings";

interface Settings {
  enableHaptics: boolean;
  responseStyle: "concise" | "detailed";
}

const defaultSettings: Settings = {
  enableHaptics: true,
  responseStyle: "detailed",
};

export default function SettingsScreen() {
  const colors = useColors();
  const { clearMessages } = useChat();
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      if (stored) {
        setSettings(JSON.parse(stored));
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

  const renderSettingItem = ({
    icon,
    title,
    subtitle,
    rightElement,
    onPress,
    destructive,
  }: {
    icon: "moon" | "sparkles" | "trash" | "info.circle" | "globe";
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
            subtitle: "الإصدار 1.0.0",
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
            مدعوم بتقنية Google Gemini AI
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

import React, { useState, useEffect } from "react";
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
import { ProviderSelector } from "@/components/provider-selector";
import { TokenBalance } from "@/components/token-balance";
import { TokenShop } from "@/components/token-shop";
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

type SettingsTab = "general" | "providers" | "tokens" | "shop";

export default function SettingsScreen() {
  const colors = useColors();
  const { clearMessages } = useChat();
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");

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

      {/* Tab Navigation */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        {(["general", "providers", "tokens", "shop"] as SettingsTab[]).map((tab) => (
          <Pressable
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={({ pressed }) => [
              styles.tab,
              activeTab === tab && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === tab ? colors.primary : colors.muted },
              ]}
            >
              {tab === "general" && "عام"}
              {tab === "providers" && "المزودون"}
              {tab === "tokens" && "الرموز"}
              {tab === "shop" && "المتجر"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Content */}
      {activeTab === "general" && (
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
        </ScrollView>
      )}

      {activeTab === "providers" && <ProviderSelector />}
      {activeTab === "tokens" && <TokenBalance />}
      {activeTab === "shop" && <TokenShop />}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingHorizontal: 0,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: {
    fontSize: 12,
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  section: {
    gap: 12,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  settingContent: {
    flex: 1,
    gap: 4,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  settingSubtitle: {
    fontSize: 12,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
});

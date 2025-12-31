import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import * as Clipboard from "expo-clipboard";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { processCode } from "@/lib/ai-service";
import { CodeMode } from "@/lib/types";
import * as Haptics from "expo-haptics";

const MODES: { id: CodeMode; label: string; labelAr: string }[] = [
  { id: "generate", label: "Generate", labelAr: "إنشاء" },
  { id: "review", label: "Review", labelAr: "مراجعة" },
  { id: "explain", label: "Explain", labelAr: "شرح" },
];

const LANGUAGES = [
  { id: "javascript", label: "JavaScript" },
  { id: "typescript", label: "TypeScript" },
  { id: "python", label: "Python" },
  { id: "java", label: "Java" },
  { id: "csharp", label: "C#" },
  { id: "cpp", label: "C++" },
  { id: "go", label: "Go" },
  { id: "rust", label: "Rust" },
  { id: "swift", label: "Swift" },
  { id: "kotlin", label: "Kotlin" },
  { id: "php", label: "PHP" },
  { id: "ruby", label: "Ruby" },
  { id: "sql", label: "SQL" },
  { id: "html", label: "HTML/CSS" },
];

const PLACEHOLDERS: Record<CodeMode, string> = {
  generate: "صف الكود الذي تريد إنشاءه...\n\nمثال: اكتب دالة لحساب مجموع الأرقام في مصفوفة",
  review: "الصق الكود هنا للمراجعة...",
  explain: "الصق الكود هنا للشرح...",
};

export default function CodeScreen() {
  const colors = useColors();
  const [mode, setMode] = useState<CodeMode>("generate");
  const [language, setLanguage] = useState("javascript");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showLanguages, setShowLanguages] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleModeChange = (newMode: CodeMode) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setMode(newMode);
    setOutput("");
  };

  const handleProcess = async () => {
    if (!input.trim()) return;

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setIsLoading(true);
    setOutput("");

    try {
      const response = await processCode(mode, input.trim(), language);
      setOutput(response.content || response.error || "حدث خطأ غير متوقع");
    } catch (error) {
      setOutput("عذراً، حدث خطأ في معالجة الكود. يرجى المحاولة مرة أخرى.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!output) return;

    await Clipboard.setStringAsync(output);
    setCopied(true);

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    setTimeout(() => setCopied(false), 2000);
  };

  const getButtonText = () => {
    switch (mode) {
      case "generate":
        return "إنشاء الكود";
      case "review":
        return "مراجعة الكود";
      case "explain":
        return "شرح الكود";
    }
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>مساعد الكود</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {/* Mode Selector */}
        <View style={[styles.modeContainer, { backgroundColor: colors.surface }]}>
          {MODES.map((m) => (
            <Pressable
              key={m.id}
              onPress={() => handleModeChange(m.id)}
              style={[
                styles.modeButton,
                mode === m.id && { backgroundColor: colors.primary },
              ]}
            >
              <Text
                style={[
                  styles.modeText,
                  { color: mode === m.id ? "#FFFFFF" : colors.foreground },
                ]}
              >
                {m.labelAr}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Language Selector */}
        <View style={styles.languageSection}>
          <Text style={[styles.sectionLabel, { color: colors.foreground }]}>لغة البرمجة</Text>
          <Pressable
            onPress={() => setShowLanguages(!showLanguages)}
            style={[
              styles.languageSelector,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.languageText, { color: colors.foreground }]}>
              {LANGUAGES.find((l) => l.id === language)?.label}
            </Text>
            <IconSymbol name="chevron.right" size={16} color={colors.muted} />
          </Pressable>

          {showLanguages && (
            <View
              style={[
                styles.languageDropdown,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              {LANGUAGES.map((lang) => (
                <Pressable
                  key={lang.id}
                  onPress={() => {
                    setLanguage(lang.id);
                    setShowLanguages(false);
                  }}
                  style={({ pressed }) => [
                    styles.languageOption,
                    language === lang.id && { backgroundColor: colors.primary + "20" },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text
                    style={[
                      styles.languageOptionText,
                      { color: language === lang.id ? colors.primary : colors.foreground },
                    ]}
                  >
                    {lang.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Input */}
        <View style={styles.inputSection}>
          <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
            {mode === "generate" ? "الوصف" : "الكود"}
          </Text>
          <TextInput
            style={[
              styles.codeInput,
              {
                backgroundColor: colors.surface,
                color: colors.foreground,
                borderColor: colors.border,
              },
            ]}
            placeholder={PLACEHOLDERS[mode]}
            placeholderTextColor={colors.muted}
            value={input}
            onChangeText={setInput}
            multiline
            numberOfLines={8}
            textAlignVertical="top"
            textAlign="right"
          />
        </View>

        {/* Process Button */}
        <Pressable
          onPress={handleProcess}
          disabled={!input.trim() || isLoading}
          style={({ pressed }) => [
            styles.processButton,
            { backgroundColor: colors.primary },
            (!input.trim() || isLoading) && { opacity: 0.5 },
            pressed && { transform: [{ scale: 0.98 }] },
          ]}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.processButtonText}>{getButtonText()}</Text>
          )}
        </Pressable>

        {/* Output */}
        {output && (
          <View style={styles.outputSection}>
            <View style={styles.outputHeader}>
              <Text style={[styles.sectionLabel, { color: colors.foreground }]}>النتيجة</Text>
              <Pressable
                onPress={handleCopy}
                style={({ pressed }) => [
                  styles.copyButton,
                  { backgroundColor: colors.surface },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <IconSymbol name="copy" size={16} color={colors.primary} />
                <Text style={[styles.copyText, { color: colors.primary }]}>
                  {copied ? "تم النسخ!" : "نسخ"}
                </Text>
              </Pressable>
            </View>
            <View
              style={[
                styles.outputContainer,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Text
                  style={[
                    styles.outputText,
                    { color: colors.foreground },
                    mode === "generate" && styles.codeText,
                  ]}
                >
                  {output}
                </Text>
              </ScrollView>
            </View>
          </View>
        )}
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
  },
  modeContainer: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  modeText: {
    fontSize: 14,
    fontWeight: "600",
  },
  languageSection: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "right",
  },
  languageSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  languageText: {
    fontSize: 14,
  },
  languageDropdown: {
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    maxHeight: 200,
  },
  languageOption: {
    padding: 12,
  },
  languageOptionText: {
    fontSize: 14,
  },
  inputSection: {
    marginBottom: 20,
  },
  codeInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    minHeight: 160,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  processButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 20,
  },
  processButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  outputSection: {
    marginBottom: 20,
  },
  outputHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  copyText: {
    fontSize: 12,
    fontWeight: "500",
  },
  outputContainer: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    minHeight: 120,
  },
  outputText: {
    fontSize: 14,
    lineHeight: 22,
  },
  codeText: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
});

import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Modal,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenContainer } from "@/components/screen-container";
import { AgentCard } from "@/components/agent-card";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ManusAgentView } from "@/components/manus-agent-view";
import { useColors } from "@/hooks/use-colors";
import { AGENTS, getAgentById } from "@/lib/agents-data";
import { executeAgentTask } from "@/lib/ai-service";
import { Agent } from "@/lib/types";
import * as Haptics from "expo-haptics";

export default function AgentsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showManusModal, setShowManusModal] = useState(false);
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const handleAgentSelect = (agent: Agent) => {
    if (agent.id === "manus") {
      setShowManusModal(true);
      return;
    }
    setSelectedAgent(agent);
    setInput("");
    setOutput("");
    setShowResult(false);
  };

  const handleCloseModal = () => {
    setSelectedAgent(null);
    setInput("");
    setOutput("");
    setShowResult(false);
  };

  const handleExecute = async () => {
    if (!selectedAgent || !input.trim()) return;

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setIsLoading(true);
    setShowResult(true);

    try {
      const response = await executeAgentTask(selectedAgent.systemPrompt, input.trim());
      setOutput(response.content || response.error || "حدث خطأ غير متوقع");
    } catch (error) {
      setOutput("عذراً، حدث خطأ في تنفيذ المهمة. يرجى المحاولة مرة أخرى.");
    } finally {
      setIsLoading(false);
    }
  };

  const renderAgent = ({ item, index }: { item: Agent; index: number }) => (
    <View style={[styles.cardWrapper, index % 2 === 0 ? { paddingRight: 6 } : { paddingLeft: 6 }]}>
      <AgentCard agent={item} onPress={() => handleAgentSelect(item)} />
    </View>
  );

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>الوكلاء</Text>
        <Text style={[styles.headerSubtitle, { color: colors.muted }]}>
          اختر وكيلاً لمساعدتك في مهمة محددة
        </Text>
      </View>

      {/* Agents Grid */}
      <FlatList
        data={AGENTS}
        renderItem={renderAgent}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      />

      {/* Manus Agent Modal */}
      <Modal
        visible={showManusModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowManusModal(false)}
      >
        <ManusAgentView onClose={() => setShowManusModal(false)} />
      </Modal>

      {/* Agent Modal */}
      <Modal
        visible={!!selectedAgent}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseModal}
      >
        <KeyboardAvoidingView
          style={[styles.modalContainer, { backgroundColor: colors.background }]}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          {/* Modal Header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Pressable onPress={handleCloseModal} style={styles.closeButton}>
              <IconSymbol name="xmark" size={24} color={colors.muted} />
            </Pressable>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {selectedAgent?.nameAr}
            </Text>
            <View style={styles.closeButton} />
          </View>

          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalContentInner}>
            {/* Agent Description */}
            <View
              style={[
                styles.descriptionCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.descriptionText, { color: colors.foreground }]}>
                {selectedAgent?.descriptionAr}
              </Text>
            </View>

            {/* Input Section */}
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              ما الذي تريد مني فعله؟
            </Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: colors.surface,
                  color: colors.foreground,
                  borderColor: colors.border,
                },
              ]}
              placeholder="اكتب طلبك هنا..."
              placeholderTextColor={colors.muted}
              value={input}
              onChangeText={setInput}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              textAlign="right"
            />

            {/* Execute Button */}
            <Pressable
              onPress={handleExecute}
              disabled={!input.trim() || isLoading}
              style={({ pressed }) => [
                styles.executeButton,
                { backgroundColor: colors.primary },
                (!input.trim() || isLoading) && { opacity: 0.5 },
                pressed && { transform: [{ scale: 0.98 }] },
              ]}
            >
              <Text style={styles.executeButtonText}>
                {isLoading ? "جاري التنفيذ..." : "تنفيذ"}
              </Text>
            </Pressable>

            {/* Result Section */}
            {showResult && (
              <View style={styles.resultSection}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>النتيجة</Text>
                <View
                  style={[
                    styles.resultCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  {isLoading ? (
                    <ActivityIndicator size="large" color={colors.primary} />
                  ) : (
                    <Text style={[styles.resultText, { color: colors.foreground }]}>{output}</Text>
                  )}
                </View>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "right",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    textAlign: "right",
  },
  grid: {
    padding: 16,
  },
  cardWrapper: {
    flex: 1,
    marginBottom: 12,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  modalContent: {
    flex: 1,
  },
  modalContentInner: {
    padding: 16,
  },
  descriptionCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  descriptionText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "right",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
    textAlign: "right",
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 120,
    marginBottom: 16,
  },
  executeButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  executeButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  resultSection: {
    marginTop: 24,
  },
  resultCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 100,
  },
  resultText: {
    fontSize: 15,
    lineHeight: 24,
    textAlign: "right",
  },
});

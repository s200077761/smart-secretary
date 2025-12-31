import { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { generateSearchSummary } from "@/lib/ai-service";
import { SearchResult } from "@/lib/types";
import * as Haptics from "expo-haptics";

const SEARCH_HISTORY_KEY = "smart_secretary_search_history";

// Mock search function - in production, integrate with a real search API
async function performSearch(query: string): Promise<SearchResult[]> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Generate mock results based on query
  const results: SearchResult[] = [
    {
      id: "1",
      title: `نتائج البحث عن: ${query}`,
      snippet: `هذه نتيجة بحث تجريبية للاستعلام "${query}". في التطبيق الحقيقي، سيتم استخدام واجهة برمجة تطبيقات بحث حقيقية.`,
      url: "https://example.com/result1",
      source: "example.com",
    },
    {
      id: "2",
      title: `معلومات إضافية حول ${query}`,
      snippet: `اكتشف المزيد من المعلومات المتعلقة بـ "${query}". هذا المحتوى توضيحي لعرض كيفية عمل ميزة البحث.`,
      url: "https://example.com/result2",
      source: "example.com",
    },
    {
      id: "3",
      title: `دليل شامل: ${query}`,
      snippet: `دليل مفصل يغطي جميع جوانب "${query}". يتضمن نصائح وإرشادات عملية.`,
      url: "https://example.com/result3",
      source: "example.com",
    },
  ];

  return results;
}

export default function SearchScreen() {
  const colors = useColors();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Failed to load search history:", error);
    }
  }, []);

  const saveToHistory = useCallback(async (searchQuery: string) => {
    try {
      const newHistory = [searchQuery, ...history.filter((h) => h !== searchQuery)].slice(0, 10);
      setHistory(newHistory);
      await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory));
    } catch (error) {
      console.error("Failed to save search history:", error);
    }
  }, [history]);

  const handleSearch = async () => {
    if (!query.trim()) return;

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    setIsLoading(true);
    setResults([]);

    try {
      const searchResults = await performSearch(query.trim());
      setResults(searchResults);
      await saveToHistory(query.trim());
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleHistorySelect = (historyQuery: string) => {
    setQuery(historyQuery);
  };

  const handleGenerateSummary = async (result: SearchResult) => {
    if (result.aiSummary) {
      setExpandedId(expandedId === result.id ? null : result.id);
      return;
    }

    setSummaryLoading(result.id);

    try {
      const response = await generateSearchSummary(
        query,
        `Title: ${result.title}\nSnippet: ${result.snippet}\nSource: ${result.source}`
      );

      setResults((prev) =>
        prev.map((r) =>
          r.id === result.id ? { ...r, aiSummary: response.content || response.error } : r
        )
      );
      setExpandedId(result.id);
    } catch (error) {
      console.error("Failed to generate summary:", error);
    } finally {
      setSummaryLoading(null);
    }
  };

  const handleOpenUrl = (url: string) => {
    Linking.openURL(url);
  };

  const renderResult = ({ item }: { item: SearchResult }) => (
    <View style={[styles.resultCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Pressable onPress={() => handleOpenUrl(item.url)}>
        <Text style={[styles.resultTitle, { color: colors.primary }]}>{item.title}</Text>
        <Text style={[styles.resultSource, { color: colors.muted }]}>{item.source}</Text>
        <Text style={[styles.resultSnippet, { color: colors.foreground }]}>{item.snippet}</Text>
      </Pressable>

      <Pressable
        onPress={() => handleGenerateSummary(item)}
        style={({ pressed }) => [
          styles.summaryButton,
          { backgroundColor: colors.primary + "15" },
          pressed && { opacity: 0.7 },
        ]}
      >
        {summaryLoading === item.id ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <>
            <IconSymbol name="sparkles" size={16} color={colors.primary} />
            <Text style={[styles.summaryButtonText, { color: colors.primary }]}>
              {item.aiSummary ? "عرض الملخص" : "ملخص AI"}
            </Text>
          </>
        )}
      </Pressable>

      {expandedId === item.id && item.aiSummary && (
        <View style={[styles.summaryContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Text style={[styles.summaryText, { color: colors.foreground }]}>{item.aiSummary}</Text>
        </View>
      )}
    </View>
  );

  const renderHistory = () => (
    <View style={styles.historySection}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>عمليات البحث السابقة</Text>
      {history.map((item, index) => (
        <Pressable
          key={index}
          onPress={() => handleHistorySelect(item)}
          style={({ pressed }) => [
            styles.historyItem,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && { opacity: 0.7 },
          ]}
        >
          <IconSymbol name="arrow.clockwise" size={16} color={colors.muted} />
          <Text style={[styles.historyText, { color: colors.foreground }]}>{item}</Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>البحث</Text>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchInputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <IconSymbol name="magnifyingglass" size={20} color={colors.muted} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="ابحث عن أي شيء..."
            placeholderTextColor={colors.muted}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
            textAlign="right"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")}>
              <IconSymbol name="xmark" size={18} color={colors.muted} />
            </Pressable>
          )}
        </View>
        <Pressable
          onPress={handleSearch}
          disabled={!query.trim() || isLoading}
          style={({ pressed }) => [
            styles.searchButton,
            { backgroundColor: colors.primary },
            (!query.trim() || isLoading) && { opacity: 0.5 },
            pressed && { transform: [{ scale: 0.95 }] },
          ]}
        >
          <Text style={styles.searchButtonText}>بحث</Text>
        </Pressable>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.muted }]}>جاري البحث...</Text>
        </View>
      ) : results.length > 0 ? (
        <FlatList
          data={results}
          renderItem={renderResult}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.resultsList}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyContainer}>
          {history.length > 0 && renderHistory()}
          {history.length === 0 && (
            <View style={styles.emptyState}>
              <IconSymbol name="magnifyingglass" size={48} color={colors.muted} />
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                ابحث عن أي موضوع واحصل على ملخصات ذكية
              </Text>
            </View>
          )}
        </View>
      )}
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
  searchContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
  },
  searchButton: {
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  searchButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  resultsList: {
    padding: 16,
  },
  resultCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
    textAlign: "right",
  },
  resultSource: {
    fontSize: 12,
    marginBottom: 8,
    textAlign: "right",
  },
  resultSnippet: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "right",
  },
  summaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 6,
  },
  summaryButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  summaryContainer: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: "right",
  },
  emptyContainer: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
  },
  historySection: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
    textAlign: "right",
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
    gap: 8,
  },
  historyText: {
    flex: 1,
    fontSize: 14,
    textAlign: "right",
  },
});

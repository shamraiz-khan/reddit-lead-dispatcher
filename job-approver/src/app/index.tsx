import * as Clipboard from "expo-clipboard";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// Laptop ka LAN IP (Terminal se verified: 192.168.100.153)
const BACKEND_URL = "http://192.168.100.153:8000";

interface Job {
  id: string;
  title: string;
  body?: string;
  author: string;
  url: string;
  pitch: string;
  chat_url: string;
}

export default function HomeScreen() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [pitchText, setPitchText] = useState<string>("");
  const [connected, setConnected] = useState<boolean>(false);

  // Poll backend every 4 seconds for fresh leads
  useEffect(() => {
    let isMounted = true;

    const fetchJobs = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/jobs`);
        if (res.ok && isMounted) {
          const data: Job[] = await res.json();
          setConnected(true);
          if (data.length > 0) {
            setJobs(data);
            setActiveJob((prev) => {
              if (!prev) {
                setPitchText(data[0].pitch);
                return data[0];
              }
              return prev;
            });
          }
        }
      } catch (err) {
        if (isMounted) setConnected(false);
      }
    };

    fetchJobs();
    const interval = setInterval(fetchJobs, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleOpenRedditPost = async (url?: string) => {
    if (!url) return;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        await Linking.openURL(url);
      }
    } catch (err) {
      Alert.alert("Error", "Could not open Reddit post.");
    }
  };

  const handleCopyAndOpenReddit = async () => {
    if (!activeJob) return;

    await Clipboard.setStringAsync(pitchText);
    Alert.alert(
      "Pitch Copied! 📋",
      "Opening Reddit DM now. Just paste and send.",
    );

    const targetUrl = activeJob.chat_url || activeJob.url;
    Linking.openURL(targetUrl).catch(() => {
      Linking.openURL(activeJob.url);
    });

    // Move to next job
    const remaining = jobs.filter((j) => j.id !== activeJob.id);
    setJobs(remaining);
    if (remaining.length > 0) {
      setActiveJob(remaining[0]);
      setPitchText(remaining[0].pitch);
    } else {
      setActiveJob(null);
      setPitchText("");
    }
  };

  const handleSkip = () => {
    if (!activeJob) return;
    const remaining = jobs.filter((j) => j.id !== activeJob.id);
    setJobs(remaining);
    if (remaining.length > 0) {
      setActiveJob(remaining[0]);
      setPitchText(remaining[0].pitch);
    } else {
      setActiveJob(null);
      setPitchText("");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>🚀 Reddit Lead Dispatcher</Text>

      <View
        style={[
          styles.statusBox,
          { borderLeftColor: connected ? "#10b981" : "#ef4444" },
        ]}
      >
        <Text
          style={[
            styles.statusText,
            { color: connected ? "#10b981" : "#ef4444" },
          ]}
        >
          {connected
            ? "● Connected to Backend (Polling Live)"
            : "○ Connecting to Backend..."}
        </Text>
      </View>

      {activeJob ? (
        <View style={styles.card}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>🔥 LIVE MATCH</Text>
          </View>

          <Text style={styles.title}>{activeJob.title}</Text>
          <Text style={styles.author}>Client: u/{activeJob.author}</Text>

          {/* Clean Description Text */}
          {activeJob.body ? (
            <View style={styles.bodyBox}>
              <Text style={styles.bodyLabel}>Post Details:</Text>
              <Text style={styles.bodyText} numberOfLines={6}>
                {activeJob.body}
              </Text>
            </View>
          ) : null}

          {/* Direct Button to inspect complete original Reddit thread */}
          <TouchableOpacity
            style={styles.openPostBtn}
            onPress={() => handleOpenRedditPost(activeJob.url)}
          >
            <Text style={styles.openPostBtnText}>🔗 View Full Post on Reddit</Text>
          </TouchableOpacity>

          <Text style={styles.label}>AI Drafted Pitch (Editable):</Text>
          <TextInput
            style={styles.textInput}
            multiline
            numberOfLines={4}
            value={pitchText}
            onChangeText={setPitchText}
          />

          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.button, styles.skipBtn]}
              onPress={handleSkip}
            >
              <Text style={styles.btnText}>Skip</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.sendBtn]}
              onPress={handleCopyAndOpenReddit}
            >
              <Text style={styles.btnText}>Copy & Message ➔</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.emptyTitle}>Scanning Reddit Feeds...</Text>
          <Text style={styles.emptySub}>
            Make sure server.py is running on your laptop. Jobs will appear here
            automatically.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: "#0f172a",
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 15,
    textAlign: "center",
  },
  statusBox: {
    backgroundColor: "#1e293b",
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
    borderLeftWidth: 4,
  },
  statusText: { 
    fontWeight: "bold", 
    fontSize: 13 
  },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#334155",
  },
  badge: {
    backgroundColor: "#2563eb",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 10,
  },
  badgeText: { 
    color: "#fff", 
    fontSize: 11, 
    fontWeight: "bold" 
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#f8fafc",
    marginBottom: 4,
    lineHeight: 22,
  },
  author: { 
    color: "#94a3b8", 
    fontSize: 13, 
    marginBottom: 12 
  },
  bodyBox: {
    backgroundColor: "#0f172a",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#334155",
  },
  bodyLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  bodyText: {
    color: "#e2e8f0",
    fontSize: 13,
    lineHeight: 19,
  },
  openPostBtn: {
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#38bdf8",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  openPostBtnText: {
    color: "#38bdf8",
    fontSize: 13,
    fontWeight: "600",
  },
  label: { 
    color: "#cbd5e1", 
    fontSize: 13, 
    fontWeight: "600", 
    marginBottom: 8 
  },
  textInput: {
    backgroundColor: "#0f172a",
    color: "#fff",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: "#475569",
    marginBottom: 16,
  },
  btnRow: { 
    flexDirection: "row", 
    gap: 10 
  },
  button: { 
    flex: 1, 
    padding: 14, 
    borderRadius: 10, 
    alignItems: "center" 
  },
  sendBtn: { 
    backgroundColor: "#10b981" 
  },
  skipBtn: { 
    backgroundColor: "#334155" 
  },
  btnText: { 
    color: "#fff", 
    fontWeight: "bold", 
    fontSize: 14 
  },
  emptyState: { 
    alignItems: "center", 
    marginTop: 100, 
    paddingHorizontal: 20 
  },
  emptyTitle: {
    color: "#cbd5e1",
    fontSize: 17,
    fontWeight: "bold",
    marginTop: 15,
  },
  emptySub: {
    color: "#64748b",
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 18,
  },
});
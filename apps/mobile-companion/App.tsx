import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import WebView from "react-native-webview";
import { normalizePreviewUrl } from "./preview-url.mjs";

const COLORS = {
  white: "#F7F6FF",
  muted: "#8B92AA",
  lavender: "#B8A8FF",
  mint: "#81E4BC",
};

export default function MobileCompanion() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scanNotice, setScanNotice] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const webViewRef = useRef<WebView>(null);
  const scanLock = useRef(false);
  const lastNoticeAt = useRef(0);
  const scanPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(scanPulse, { toValue: 1, duration: 1150, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(scanPulse, { toValue: 0, duration: 1150, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [scanPulse]);

  const handleScan = useCallback(({ data }: { data: string }) => {
    if (scanLock.current) return;
    const safeUrl = normalizePreviewUrl(data);
    if (!safeUrl) {
      const now = Date.now();
      if (now - lastNoticeAt.current > 1500) {
        setScanNotice("That QR is not a private Luma Studio link.");
        lastNoticeAt.current = now;
      }
      return;
    }

    scanLock.current = true;
    setScanNotice("");
    setLoadError("");
    setLoading(true);
    setLoadProgress(0);
    setPreviewUrl(safeUrl);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }, []);

  const scanAgain = () => {
    scanLock.current = false;
    setPreviewUrl(null);
    setScanNotice("");
    setLoadError("");
    setLoading(false);
    setLoadProgress(0);
  };

  const retryPreview = () => {
    setLoadError("");
    setLoading(true);
    setLoadProgress(0);
    webViewRef.current?.reload();
  };

  if (!permission) {
    return <CompanionBackdrop><LoadingPermission /></CompanionBackdrop>;
  }

  if (!permission.granted && !previewUrl) {
    return (
      <CompanionBackdrop>
        <View style={[styles.permissionScreen, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 28 }]}>
          <BrandHeader />
          <View style={styles.permissionCenter}>
            <View style={styles.permissionIcon}>
              <Ionicons name="qr-code-outline" size={34} color={COLORS.lavender} />
            </View>
            <Text style={styles.permissionTitle}>Let’s connect your PC.</Text>
            <Text style={styles.permissionDescription}>
              Luma Link uses your camera only to scan the private QR code shown by Luma Studio on your computer.
            </Text>
            <ActionButton label="Allow camera access" icon="camera-outline" onPress={() => void requestPermission()} />
            {permission.canAskAgain === false && (
              <Pressable onPress={() => void Linking.openSettings()} style={styles.settingsLink}>
                <Text style={styles.settingsLinkText}>Open device settings</Text>
              </Pressable>
            )}
          </View>
          <Text style={styles.localOnlyFoot}>YOUR PREVIEW STAYS ON YOUR LOCAL NETWORK</Text>
        </View>
      </CompanionBackdrop>
    );
  }

  if (previewUrl) {
    const host = new URL(previewUrl).host;
    return (
      <View style={styles.previewScreen}>
        <WebView
          ref={webViewRef}
          source={{ uri: previewUrl }}
          style={styles.webView}
          originWhitelist={["http://*"]}
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="always"
          setSupportMultipleWindows={false}
          allowsBackForwardNavigationGestures
          onLoadStart={() => {
            setLoading(true);
            setLoadError("");
          }}
          onLoadProgress={({ nativeEvent }) => setLoadProgress(nativeEvent.progress)}
          onLoadEnd={() => setLoading(false)}
          onError={(event) => {
            setLoading(false);
            setLoadError(event.nativeEvent.description || "Could not connect to the PC preview.");
          }}
          onHttpError={({ nativeEvent }) => {
            if (nativeEvent.statusCode >= 400) {
              setLoading(false);
              setLoadError(`The PC preview returned HTTP ${nativeEvent.statusCode}.`);
            }
          }}
          onShouldStartLoadWithRequest={(request) => {
            if (request.url === "about:blank") return true;
            try {
              return new URL(request.url).host === host && new URL(request.url).protocol === "http:";
            } catch {
              return false;
            }
          }}
        />

        <View style={[styles.previewToolbar, { top: insets.top + 8 }]}>
          <ActionIcon name="chevron-back" label="Scan another QR code" onPress={scanAgain} />
          <View style={styles.previewToolbarCopy}>
            <View style={styles.previewTitleLine}>
              <View style={styles.previewLiveDot} />
              <Text style={styles.previewToolbarTitle}>LIVE PREVIEW</Text>
            </View>
            <Text numberOfLines={1} style={styles.previewHost}>{host}</Text>
          </View>
          <ActionIcon name="refresh" label="Reload preview" onPress={retryPreview} />
        </View>

        {loading && !loadError && (
          <View pointerEvents="none" style={styles.loadingOverlay}>
            <BlurView intensity={38} tint="dark" style={styles.loadingCard}>
              <ActivityIndicator color={COLORS.lavender} size="small" />
              <Text style={styles.loadingTitle}>Connecting to your PC…</Text>
              <Text style={styles.loadingSubtitle}>{Math.round(loadProgress * 100)}% · local network</Text>
            </BlurView>
          </View>
        )}

        {loadError ? (
          <View style={[styles.errorOverlay, { paddingTop: insets.top + 80, paddingBottom: insets.bottom + 28 }]}>
            <GlassCard style={styles.errorCard}>
              <View style={styles.errorIcon}><Ionicons name="wifi-outline" size={27} color="#FFB1BB" /></View>
              <Text style={styles.errorTitle}>Couldn’t reach the PC.</Text>
              <Text style={styles.errorDescription}>{loadError}</Text>
              <Text style={styles.errorHint}>Check that both devices are on the same Wi-Fi and allow Node.js through Windows Firewall on private networks.</Text>
              <ActionButton label="Try again" icon="refresh" onPress={retryPreview} />
              <Pressable onPress={scanAgain} style={styles.scanAnotherLink}>
                <Text style={styles.scanAnotherLinkText}>Scan another code</Text>
              </Pressable>
            </GlassCard>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.scannerScreen}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={handleScan}
      />
      <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
        <LinearGradient
          colors={["rgba(8,10,20,0.83)", "rgba(9,11,20,0.22)", "rgba(8,10,20,0.35)", "rgba(8,10,20,0.95)"]}
          locations={[0, 0.27, 0.62, 1]}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.cameraVignette} />
      </View>

      <View style={[styles.scannerContent, { paddingTop: insets.top + 13, paddingBottom: insets.bottom + 16 }]}>
        <BrandHeader />
        <View style={styles.scanIntro}>
          <Text style={styles.scanEyebrow}>PRIVATE · LOCAL · INSTANT</Text>
          <Text style={styles.scanTitle}>Bring your PC{`\n`}a little closer.</Text>
          <Text style={styles.scanDescription}>Scan the QR code in Luma Studio to see your live app here.</Text>
        </View>

        <View style={styles.scanStage}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.scanGlow,
              {
                opacity: scanPulse.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0.66] }),
                transform: [{ scale: scanPulse.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.04] }) }],
              },
            ]}
          />
          <View style={styles.scanFrame}>
            <View style={[styles.scanCorner, styles.cornerTL]} />
            <View style={[styles.scanCorner, styles.cornerTR]} />
            <View style={[styles.scanCorner, styles.cornerBL]} />
            <View style={[styles.scanCorner, styles.cornerBR]} />
            <View style={styles.scanCenterMark}><Ionicons name="scan-outline" size={31} color="rgba(250,248,255,0.72)" /></View>
          </View>
          <View style={styles.scanHintPill}>
            <Ionicons name="sparkles-outline" size={13} color={COLORS.lavender} />
            <Text style={styles.scanHintText}>ALIGN THE QR INSIDE THE FRAME</Text>
          </View>
        </View>

        <GlassCard style={styles.connectCard}>
          <View style={styles.connectIcon}><Ionicons name="wifi-outline" size={18} color={COLORS.mint} /></View>
          <View style={styles.connectCopy}>
            <Text style={styles.connectTitle}>Same Wi-Fi, same moment.</Text>
            <Text style={styles.connectCaption}>Keep your phone and computer on one network.</Text>
          </View>
          <View style={styles.localBadge}><View style={styles.localBadgeDot} /><Text style={styles.localBadgeText}>LOCAL</Text></View>
        </GlassCard>

        <Text style={styles.localOnlyFoot}>YOUR PREVIEW STAYS ON YOUR LOCAL NETWORK</Text>
        {scanNotice ? <View style={styles.scanNotice}><Ionicons name="alert-circle-outline" size={15} color="#FFD2B8" /><Text style={styles.scanNoticeText}>{scanNotice}</Text></View> : null}
      </View>
    </View>
  );
}

function CompanionBackdrop({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.permissionScreen}>
      <LinearGradient colors={["#11152A", "#090C17", "#0B121B"]} style={StyleSheet.absoluteFillObject} />
      <View style={styles.permissionGlow} />
      {children}
    </View>
  );
}

function LoadingPermission() {
  return (
    <View style={styles.permissionCenter}>
      <ActivityIndicator size="small" color={COLORS.lavender} />
      <Text style={styles.permissionDescription}>Preparing your camera…</Text>
    </View>
  );
}

function BrandHeader() {
  return (
    <View style={styles.brandHeader}>
      <LinearGradient colors={["#C5B5FF", "#6D82F6"]} style={styles.brandMark}>
        <Ionicons name="sparkles" size={17} color="#FFFFFF" />
      </LinearGradient>
      <View style={styles.brandCopy}>
        <Text style={styles.brandName}>luma link</Text>
        <Text style={styles.brandCaption}>LIVE APP COMPANION</Text>
      </View>
      <View style={styles.localOnlyPill}><View style={styles.localBadgeDot} /><Text style={styles.localBadgeText}>PC LINK</Text></View>
    </View>
  );
}

function GlassCard({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View style={[styles.glassCard, style]}>
      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(255,255,255,0.11)", "rgba(255,255,255,0.035)"]}
        style={StyleSheet.absoluteFillObject}
      />
      <View pointerEvents="none" style={styles.glassBorder} />
      {children}
    </View>
  );
}

function ActionButton({ label, icon, onPress }: { label: string; icon: React.ComponentProps<typeof Ionicons>["name"]; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.975, friction: 7, tension: 120, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, friction: 7, tension: 120, useNativeDriver: true }).start()}
        style={styles.actionButton}
      >
        <LinearGradient colors={["#B8A8FF", "#8290F1"]} style={styles.actionButtonFill}>
          <Ionicons name={icon} size={17} color="#18162C" />
          <Text style={styles.actionButtonText}>{label}</Text>
          <Ionicons name="arrow-forward" size={15} color="#292343" />
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

function ActionIcon({ name, label, onPress }: { name: React.ComponentProps<typeof Ionicons>["name"]; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.actionIcon}>
      <Ionicons name={name} size={19} color={COLORS.white} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scannerScreen: { flex: 1, backgroundColor: "#090C17", overflow: "hidden" },
  scannerContent: { flex: 1, paddingHorizontal: 24, justifyContent: "space-between" },
  cameraVignette: { ...StyleSheet.absoluteFillObject, borderWidth: 26, borderColor: "rgba(5,7,14,0.16)" },
  brandHeader: { flexDirection: "row", alignItems: "center", gap: 11 },
  brandMark: { width: 37, height: 37, borderRadius: 13, alignItems: "center", justifyContent: "center", shadowColor: "#9583FF", shadowOpacity: 0.36, shadowRadius: 13, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
  brandCopy: { flex: 1 },
  brandName: { color: COLORS.white, fontSize: 16, fontWeight: "700", letterSpacing: 0.1 },
  brandCaption: { color: "#A0A6BA", fontSize: 8, fontWeight: "700", letterSpacing: 1.5, marginTop: 3 },
  localOnlyPill: { height: 29, borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.13)", backgroundColor: "rgba(11,14,27,0.36)", paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 6 },
  localBadgeDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.mint },
  localBadgeText: { color: "#D4D1E5", fontSize: 8, fontWeight: "700", letterSpacing: 1 },
  scanIntro: { marginTop: 28 },
  scanEyebrow: { color: "#B8A8FF", fontSize: 9, fontWeight: "700", letterSpacing: 1.7, marginBottom: 9 },
  scanTitle: { color: COLORS.white, fontSize: 34, lineHeight: 38, fontWeight: "700", letterSpacing: -0.8 },
  scanDescription: { color: "#C0C3D0", fontSize: 12, lineHeight: 18, marginTop: 9, maxWidth: 280 },
  scanStage: { height: 286, alignItems: "center", justifyContent: "center", marginTop: 4, marginBottom: 4 },
  scanGlow: { position: "absolute", width: 250, height: 250, borderRadius: 125, backgroundColor: "#8D78FF" },
  scanFrame: { width: 242, height: 242, borderRadius: 31, borderWidth: 1, borderColor: "rgba(236,231,255,0.32)", backgroundColor: "rgba(12,13,24,0.17)", alignItems: "center", justifyContent: "center" },
  scanCorner: { position: "absolute", width: 31, height: 31, borderColor: "#E3DAFF", borderWidth: 3 },
  cornerTL: { top: -2, left: -2, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 12 },
  cornerTR: { top: -2, right: -2, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 12 },
  cornerBL: { bottom: -2, left: -2, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 12 },
  cornerBR: { bottom: -2, right: -2, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 12 },
  scanCenterMark: { width: 62, height: 62, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(18,19,33,0.28)", borderWidth: 1, borderColor: "rgba(255,255,255,0.11)" },
  scanHintPill: { position: "absolute", bottom: 0, height: 30, borderRadius: 15, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "rgba(15,17,31,0.72)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  scanHintText: { color: "#E2DDF7", fontSize: 8, fontWeight: "700", letterSpacing: 0.8 },
  glassCard: { borderRadius: 21, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.055)", borderWidth: 1, borderColor: "rgba(255,255,255,0.11)" },
  glassBorder: { ...StyleSheet.absoluteFillObject, borderRadius: 21, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  connectCard: { minHeight: 67, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 10 },
  connectIcon: { width: 35, height: 35, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(129,228,188,0.09)" },
  connectCopy: { flex: 1 },
  connectTitle: { color: COLORS.white, fontSize: 10, fontWeight: "700" },
  connectCaption: { color: "#9BA1B4", fontSize: 8, marginTop: 4 },
  localBadge: { height: 24, paddingHorizontal: 8, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(129,228,188,0.075)" },
  localOnlyFoot: { alignSelf: "center", color: "rgba(218,217,231,0.62)", fontSize: 8, fontWeight: "700", letterSpacing: 1.1, marginTop: 15 },
  scanNotice: { position: "absolute", bottom: 70, left: 24, right: 24, minHeight: 40, paddingHorizontal: 12, borderRadius: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: "rgba(34,25,24,0.92)", borderWidth: 1, borderColor: "rgba(255,210,184,0.18)" },
  scanNoticeText: { color: "#FFE2CF", fontSize: 10, textAlign: "center" },
  permissionScreen: { flex: 1, justifyContent: "space-between", paddingHorizontal: 25, backgroundColor: "#0A0C17", overflow: "hidden" },
  permissionGlow: { position: "absolute", top: -125, right: -130, width: 340, height: 340, borderRadius: 170, backgroundColor: "#40336D", opacity: 0.32 },
  permissionCenter: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 15 },
  permissionIcon: { width: 77, height: 77, borderRadius: 27, backgroundColor: "rgba(181,165,255,0.1)", borderWidth: 1, borderColor: "rgba(181,165,255,0.18)", alignItems: "center", justifyContent: "center", marginBottom: 21 },
  permissionTitle: { color: COLORS.white, fontSize: 23, fontWeight: "700", textAlign: "center" },
  permissionDescription: { color: "#A7ADBF", fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 10, marginBottom: 22, maxWidth: 290 },
  settingsLink: { padding: 12, marginTop: 5 },
  settingsLinkText: { color: COLORS.lavender, fontSize: 11, fontWeight: "600" },
  actionButton: { height: 49, borderRadius: 16, overflow: "hidden", marginTop: 4 },
  actionButtonFill: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 19 },
  actionButtonText: { color: "#1A1730", fontSize: 12, fontWeight: "700", letterSpacing: 0.1 },
  previewScreen: { flex: 1, backgroundColor: "#090C17" },
  webView: { flex: 1, backgroundColor: "#090C17" },
  previewToolbar: { position: "absolute", left: 13, right: 13, height: 56, borderRadius: 19, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(12,14,27,0.88)", borderWidth: 1, borderColor: "rgba(255,255,255,0.13)", overflow: "hidden" },
  previewToolbarCopy: { flex: 1, minWidth: 0 },
  previewTitleLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  previewLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.mint },
  previewToolbarTitle: { color: COLORS.white, fontSize: 9, fontWeight: "700", letterSpacing: 1.15 },
  previewHost: { color: "#9DA4B8", fontSize: 9, marginTop: 4 },
  actionIcon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.075)" },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(7,9,17,0.1)" },
  loadingCard: { minWidth: 190, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 18, alignItems: "center", gap: 8, overflow: "hidden", backgroundColor: "rgba(17,19,35,0.88)", borderWidth: 1, borderColor: "rgba(255,255,255,0.13)" },
  loadingTitle: { color: COLORS.white, fontSize: 11, fontWeight: "700", marginTop: 4 },
  loadingSubtitle: { color: COLORS.muted, fontSize: 9 },
  errorOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: "center", paddingHorizontal: 25, backgroundColor: "rgba(7,8,15,0.78)" },
  errorCard: { alignItems: "center", padding: 22 },
  errorIcon: { width: 57, height: 57, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,177,187,0.09)" },
  errorTitle: { color: COLORS.white, fontSize: 19, fontWeight: "700", marginTop: 14 },
  errorDescription: { color: "#E2DDE9", fontSize: 11, lineHeight: 17, textAlign: "center", marginTop: 8 },
  errorHint: { color: COLORS.muted, fontSize: 10, lineHeight: 15, textAlign: "center", marginTop: 11, marginBottom: 13 },
  scanAnotherLink: { padding: 13, marginTop: 3 },
  scanAnotherLinkText: { color: COLORS.lavender, fontSize: 10, fontWeight: "700" },
});

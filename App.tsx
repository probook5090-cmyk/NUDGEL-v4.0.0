import React, { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  BackHandler,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { CONTACTS, SEED_MESSAGES, SELF, type ChatMessage, type Person } from "./src/data";

const SPRING = { friction: 9, tension: 76, useNativeDriver: true } as const;
const QUICK_SPRING = { friction: 7, tension: 120, useNativeDriver: true } as const;
const HORIZONTAL_GUTTER = 20;
const CHAT_BACK_BUTTON = 44;
const CHAT_HEADER_GAP = 12;
const CHAT_AVATAR_SIZE = 44;
const MAX_CONTENT_WIDTH = 520;

type Rect = { x: number; y: number; size: number };
type AvatarRef = React.RefObject<View | null>;
type Insets = ReturnType<typeof useSafeAreaInsets>;
type IconName = React.ComponentProps<typeof Ionicons>["name"];
type FilterMode = "all" | "unread" | "online";
type Flight = { person: Person; from: Rect; to: Rect };

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <AppFlow />
    </SafeAreaProvider>
  );
}

function AppFlow() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [activeContact, setActiveContact] = useState<Person | null>(null);
  const [threads, setThreads] = useState<Record<string, ChatMessage[]>>(SEED_MESSAGES);
  const [typingContactId, setTypingContactId] = useState<string | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [composeMounted, setComposeMounted] = useState(false);
  const [flight, setFlight] = useState<Flight | null>(null);
  const navProgress = useRef(new Animated.Value(0)).current;
  const flightProgress = useRef(new Animated.Value(0)).current;
  const composeProgress = useRef(new Animated.Value(0)).current;
  const originRect = useRef<Rect | null>(null);
  const navigationLocked = useRef(false);
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(
    () => () => {
      if (replyTimer.current) clearTimeout(replyTimer.current);
    }, [],
  );

  const chatAvatarPosition = useCallback(
    (): Rect => ({
      x:
        Math.max(0, (width - MAX_CONTENT_WIDTH) / 2) +
        insets.left +
        HORIZONTAL_GUTTER +
        CHAT_BACK_BUTTON +
        CHAT_HEADER_GAP,
      y: insets.top + 12 + (48 - CHAT_AVATAR_SIZE) / 2,
      size: CHAT_AVATAR_SIZE,
    }),
    [insets.left, insets.top, width],
  );

  const openConversation = useCallback(
    (person: Person, sourceRef?: AvatarRef) => {
      if (navigationLocked.current) return;
      Keyboard.dismiss();
      void Haptics.selectionAsync().catch(() => undefined);
      navigationLocked.current = true;

      const begin = (source?: Rect) => {
        originRect.current = source ?? null;
        setActiveContact(person);
        navProgress.stopAnimation();
        flightProgress.stopAnimation();

        if (reduceMotion) {
          navProgress.setValue(1);
          setFlight(null);
          navigationLocked.current = false;
          return;
        }

        navProgress.setValue(0);
        const target = chatAvatarPosition();
        if (source) {
          setFlight({ person, from: source, to: target });
          flightProgress.setValue(0);
        } else {
          setFlight(null);
        }

        const animations: Animated.CompositeAnimation[] = [
          Animated.spring(navProgress, { toValue: 1, ...SPRING }),
        ];
        if (source) {
          animations.push(Animated.spring(flightProgress, { toValue: 1, ...SPRING }));
        }
        Animated.parallel(animations).start(({ finished }) => {
          navigationLocked.current = false;
          if (finished && source) setFlight(null);
        });
      };

      if (sourceRef?.current && !reduceMotion) {
        sourceRef.current.measureInWindow((x, y, measuredWidth, measuredHeight) => {
          if (measuredWidth > 0 && measuredHeight > 0) {
            begin({ x, y, size: Math.min(measuredWidth, measuredHeight) });
          } else {
            begin();
          }
        });
      } else {
        begin();
      }
    },
    [chatAvatarPosition, flightProgress, navProgress, reduceMotion],
  );

  const closeConversation = useCallback(() => {
    if (!activeContact || navigationLocked.current) return;
    Keyboard.dismiss();
    navigationLocked.current = true;
    navProgress.stopAnimation();
    flightProgress.stopAnimation();

    const origin = originRect.current;
    if (reduceMotion) {
      navProgress.setValue(0);
      setFlight(null);
      setActiveContact(null);
      originRect.current = null;
      navigationLocked.current = false;
      return;
    }

    const animations: Animated.CompositeAnimation[] = [
      Animated.spring(navProgress, { toValue: 0, ...SPRING }),
    ];
    if (origin) {
      setFlight({ person: activeContact, from: chatAvatarPosition(), to: origin });
      flightProgress.setValue(0);
      animations.push(Animated.spring(flightProgress, { toValue: 1, ...SPRING }));
    } else {
      setFlight(null);
    }

    Animated.parallel(animations).start(() => {
      setActiveContact(null);
      setFlight(null);
      originRect.current = null;
      navigationLocked.current = false;
    });
  }, [activeContact, chatAvatarPosition, flightProgress, navProgress, reduceMotion]);

  const closeCompose = useCallback(
    (after?: () => void) => {
      composeProgress.stopAnimation();
      if (!composeMounted || reduceMotion) {
        composeProgress.setValue(0);
        setComposeMounted(false);
        after?.();
        return;
      }
      Animated.timing(composeProgress, {
        toValue: 0,
        duration: 230,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        setComposeMounted(false);
        if (finished) after?.();
      });
    },
    [composeMounted, composeProgress, reduceMotion],
  );

  const openCompose = useCallback(() => {
    Keyboard.dismiss();
    if (reduceMotion) {
      composeProgress.setValue(1);
      setComposeMounted(true);
      return;
    }
    composeProgress.stopAnimation();
    composeProgress.setValue(0);
    setComposeMounted(true);
    requestAnimationFrame(() => {
      Animated.spring(composeProgress, { toValue: 1, ...SPRING }).start();
    });
  }, [composeProgress, reduceMotion]);

  const selectComposeContact = useCallback(
    (person: Person) => {
      closeCompose(() => openConversation(person));
    },
    [closeCompose, openConversation],
  );

  useEffect(() => {
    if (composeMounted) {
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        closeCompose();
        return true;
      });
      return () => subscription.remove();
    }
    if (activeContact) {
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        closeConversation();
        return true;
      });
      return () => subscription.remove();
    }
    return undefined;
  }, [activeContact, closeCompose, closeConversation, composeMounted]);

  const sendMessage = useCallback((person: Person, text: string) => {
    const cleanText = text.trim();
    if (!cleanText) return;

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    const sentAt = Date.now();
    setThreads((current) => ({
      ...current,
      [person.id]: [
        ...(current[person.id] ?? []),
        { id: `sent-${sentAt}`, text: cleanText, mine: true, time: "now" },
      ],
    }));
    setTypingContactId(person.id);
    if (replyTimer.current) clearTimeout(replyTimer.current);
    replyTimer.current = setTimeout(() => {
      const repliedAt = Date.now();
      setThreads((current) => ({
        ...current,
        [person.id]: [
          ...(current[person.id] ?? []),
          { id: `reply-${repliedAt}`, text: person.reply, mine: false, time: "now" },
        ],
      }));
      setTypingContactId((current) => (current === person.id ? null : current));
      replyTimer.current = null;
    }, 1350);
  }, []);

  const inboxPeople = CONTACTS.map((person) => {
    const latest = threads[person.id]?.[threads[person.id].length - 1];
    return latest ? { ...person, lastMessage: latest.text, time: latest.time } : person;
  });

  const inboxOpacity = navProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.34] });
  const inboxTranslate = navProgress.interpolate({ inputRange: [0, 1], outputRange: [0, -width * 0.13] });
  const inboxScale = navProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.975] });
  const chatOpacity = navProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const chatTranslate = navProgress.interpolate({ inputRange: [0, 1], outputRange: [width * 0.94, 0] });

  return (
    <View style={styles.root}>
      <AppBackdrop />
      <Animated.View
        pointerEvents={activeContact ? "none" : "auto"}
        style={[
          styles.screenLayer,
          { opacity: inboxOpacity, transform: [{ translateX: inboxTranslate }, { scale: inboxScale }] },
        ]}
      >
        <InboxScreen
          people={inboxPeople}
          insets={insets}
          reduceMotion={reduceMotion}
          flightPersonId={flight?.person.id}
          onOpen={openConversation}
          onCompose={openCompose}
        />
      </Animated.View>

      {activeContact && (
        <Animated.View
          pointerEvents="auto"
          style={[
            styles.screenLayer,
            { opacity: chatOpacity, transform: [{ translateX: chatTranslate }] },
          ]}
        >
          <ChatScreen
            key={activeContact.id}
            person={activeContact}
            messages={threads[activeContact.id] ?? []}
            isTyping={typingContactId === activeContact.id}
            insets={insets}
            reduceMotion={reduceMotion}
            avatarHidden={flight?.person.id === activeContact.id}
            onBack={closeConversation}
            onSend={(text) => sendMessage(activeContact, text)}
          />
        </Animated.View>
      )}

      {composeMounted && (
        <ComposeSheet
          people={inboxPeople}
          insets={insets}
          height={height}
          progress={composeProgress}
          reduceMotion={reduceMotion}
          onClose={() => closeCompose()}
          onSelect={selectComposeContact}
        />
      )}

      {flight && <AvatarFlight flight={flight} progress={flightProgress} />}
    </View>
  );
}

function AppBackdrop() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <LinearGradient
        colors={["#11152A", "#0A0D18", "#0B111A"]}
        start={{ x: 0.05, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.topGlow} />
      <View style={styles.sideGlow} />
      <View style={styles.bottomGlow} />
    </View>
  );
}

type AvatarProps = { person: Person; size: number; hidden?: boolean; showStatus?: boolean };

const Avatar = forwardRef<View, AvatarProps>(function Avatar(
  { person, size, hidden = false, showStatus = true },
  ref,
) {
  return (
    <View
      ref={ref}
      collapsable={false}
      accessible
      accessibilityLabel={`${person.name}${person.online ? ", online" : ""}`}
      style={{ width: size, height: size, opacity: hidden ? 0 : 1 }}
    >
      <LinearGradient
        colors={person.colors}
        start={{ x: 0.08, y: 0.05 }}
        end={{ x: 0.95, y: 1 }}
        style={[styles.avatarSurface, { width: size, height: size, borderRadius: size / 2 }]}
      >
        <View style={[styles.avatarShine, { width: size * 0.55, height: size * 0.28 }]} />
        <Text style={[styles.avatarInitials, { fontSize: Math.max(12, size * 0.25) }]}>{person.initials}</Text>
      </LinearGradient>
      {showStatus && person.online && (
        <View
          style={[
            styles.onlineIndicator,
            { width: Math.max(9, size * 0.2), height: Math.max(9, size * 0.2), borderRadius: size },
          ]}
        />
      )}
    </View>
  );
});

function GlassSurface({
  children,
  style,
  radius = 24,
}: {
  children: React.ReactNode;
  style?: import("react-native").StyleProp<import("react-native").ViewStyle>;
  radius?: number;
}) {
  return (
    <View style={[styles.glassSurface, { borderRadius: radius }, style]}>
      <BlurView intensity={28} tint="dark" style={[StyleSheet.absoluteFillObject, { borderRadius: radius }]} />
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(255,255,255,0.095)", "rgba(255,255,255,0.027)"]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={[StyleSheet.absoluteFillObject, { borderRadius: radius }]}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          { borderRadius: radius, borderWidth: 1, borderColor: "rgba(255,255,255,0.115)" },
        ]}
      />
      {children}
    </View>
  );
}

function MotionButton({
  children,
  onPress,
  style,
  disabled = false,
  reduceMotion = false,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress: () => void;
  style?: import("react-native").StyleProp<import("react-native").ViewStyle>;
  disabled?: boolean;
  reduceMotion?: boolean;
  accessibilityLabel?: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () => {
    if (!disabled && !reduceMotion) {
      Animated.spring(scale, { toValue: 0.965, ...QUICK_SPRING }).start();
    }
  };
  const pressOut = () => {
    if (!reduceMotion) Animated.spring(scale, { toValue: 1, ...QUICK_SPRING }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        disabled={disabled}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

function CircleIconButton({
  name,
  label,
  onPress,
  reduceMotion,
}: {
  name: IconName;
  label: string;
  onPress: () => void;
  reduceMotion: boolean;
}) {
  return (
    <MotionButton
      accessibilityLabel={label}
      onPress={onPress}
      reduceMotion={reduceMotion}
      style={styles.circleButtonHit}
    >
      <GlassSurface style={styles.circleButtonSurface} radius={22}>
        <Ionicons name={name} size={20} color={COLORS.white} />
      </GlassSurface>
    </MotionButton>
  );
}

function AvatarFlight({ flight, progress }: { flight: Flight; progress: Animated.Value }) {
  const { from, to } = flight;
  const finalX = to.x + (to.size - from.size) / 2;
  const finalY = to.y + (to.size - from.size) / 2;
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [from.x, finalX] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [from.y, finalY] });
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, to.size / from.size] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.avatarFlight,
        {
          width: from.size,
          height: from.size,
          transform: [{ translateX }, { translateY }, { scale }],
        },
      ]}
    >
      <Avatar person={flight.person} size={from.size} showStatus />
    </Animated.View>
  );
}

function Entrance({
  children,
  delay,
  reduceMotion,
}: {
  children: React.ReactNode;
  delay: number;
  reduceMotion: boolean;
}) {
  const progress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 430,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [delay, progress, reduceMotion]);

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

function InboxScreen({
  people,
  insets,
  reduceMotion,
  flightPersonId,
  onOpen,
  onCompose,
}: {
  people: Person[];
  insets: Insets;
  reduceMotion: boolean;
  flightPersonId?: string;
  onOpen: (person: Person, sourceRef?: AvatarRef) => void;
  onCompose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const searchRef = useRef<TextInput>(null);
  const query = search.trim().toLocaleLowerCase();
  const filteredPeople = people.filter((person) => {
    const matchesQuery = `${person.name} ${person.lastMessage}`.toLocaleLowerCase().includes(query);
    const matchesFilter =
      filter === "all" || (filter === "unread" && person.unread > 0) || (filter === "online" && person.online);
    return matchesQuery && matchesFilter;
  });
  const unreadCount = people.reduce((count, person) => count + (person.unread > 0 ? 1 : 0), 0);
  const onlineCount = people.filter((person) => person.online).length;

  return (
    <View style={styles.inboxScreen}>
      <ScrollView
        style={styles.homeScrollViewport}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.homeContent,
          { paddingTop: insets.top + 14, paddingHorizontal: HORIZONTAL_GUTTER + insets.left },
        ]}
      >
        <View style={styles.homeTopRow}>
          <View style={styles.brandLockup}>
            <LinearGradient colors={["#C5B5FF", "#6D82F6"]} style={styles.brandMark}>
              <Ionicons name="sparkles" size={17} color="#FFFFFF" />
            </LinearGradient>
            <View>
              <Text style={styles.brandName}>luma</Text>
              <Text style={styles.brandCaption}>YOUR PEOPLE, UNMUTED</Text>
            </View>
          </View>
          <View style={styles.homeTopRight}>
            <View style={styles.onlineCountPill}>
              <View style={styles.onlinePip} />
              <Text style={styles.onlineCountText}>{onlineCount} here</Text>
            </View>
            <Avatar person={SELF} size={42} showStatus={false} />
          </View>
        </View>

        <Entrance delay={55} reduceMotion={reduceMotion}>
          <View style={styles.heroBlock}>
            <Text style={styles.heroEyebrow}>A QUIETER CORNER OF YOUR DAY</Text>
            <Text style={styles.heroTitle}>Make room for</Text>
            <Text style={[styles.heroTitle, styles.heroAccent]}>good talks.</Text>
            <Text style={styles.heroCaption}>A little space for the people who feel like home.</Text>
          </View>
        </Entrance>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>Your conversations</Text>
            <Text style={styles.sectionSubtitle}>Small moments, kept close.</Text>
          </View>
          <View style={styles.messageCountPill}>
            <Ionicons name="chatbubbles-outline" size={14} color={COLORS.lavender} />
            <Text style={styles.messageCountText}>{people.length.toString().padStart(2, "0")}</Text>
          </View>
        </View>

        <GlassSurface style={styles.searchSurface} radius={20}>
          <Ionicons name="search-outline" size={19} color={COLORS.muted} />
          <TextInput
            ref={searchRef}
            value={search}
            onChangeText={setSearch}
            placeholder="Find a person or a moment"
            placeholderTextColor={COLORS.muted}
            selectionColor={COLORS.lavender}
            returnKeyType="search"
            style={styles.searchInput}
            accessibilityLabel="Search conversations"
          />
          {search.length > 0 ? (
            <Pressable
              onPress={() => setSearch("")}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={10}
            >
              <Ionicons name="close-circle" size={18} color={COLORS.muted} />
            </Pressable>
          ) : (
            <View style={styles.searchHint}>
              <Text style={styles.searchHintText}>⌕</Text>
            </View>
          )}
        </GlassSurface>

        <View style={styles.filterRow}>
          <FilterChip label="All" selected={filter === "all"} onPress={() => setFilter("all")} reduceMotion={reduceMotion} />
          <FilterChip
            label={`Unread  ${unreadCount}`}
            selected={filter === "unread"}
            onPress={() => setFilter("unread")}
            reduceMotion={reduceMotion}
          />
          <FilterChip
            label="Online"
            selected={filter === "online"}
            onPress={() => setFilter("online")}
            reduceMotion={reduceMotion}
          />
        </View>

        <GlassSurface style={styles.peoplePanel} radius={27}>
          {filteredPeople.length > 0 ? (
            filteredPeople.map((person, index) => (
              <Entrance key={person.id} delay={95 + index * 54} reduceMotion={reduceMotion}>
                <ConversationRow
                  person={person}
                  last={index === filteredPeople.length - 1}
                  reduceMotion={reduceMotion}
                  avatarHidden={flightPersonId === person.id}
                  onPress={(avatarRef) => onOpen(person, avatarRef)}
                />
              </Entrance>
            ))
          ) : (
            <View style={styles.emptySearch}>
              <Ionicons name="moon-outline" size={23} color={COLORS.lavender} />
              <Text style={styles.emptySearchTitle}>Nothing here just yet.</Text>
              <Text style={styles.emptySearchText}>Try another name, or switch the filter.</Text>
            </View>
          )}
        </GlassSurface>

        <View style={styles.footerWhisper}>
          <View style={styles.footerLine} />
          <Text style={styles.footerWhisperText}>LESS NOISE. MORE “I’M HERE.”</Text>
          <View style={styles.footerLine} />
        </View>
      </ScrollView>

      <BottomDock
        insets={insets}
        reduceMotion={reduceMotion}
        onSearch={() => searchRef.current?.focus()}
        onCompose={onCompose}
      />
    </View>
  );
}

function FilterChip({
  label,
  selected,
  onPress,
  reduceMotion,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  reduceMotion: boolean;
}) {
  return (
    <MotionButton
      onPress={onPress}
      reduceMotion={reduceMotion}
      style={[styles.filterChip, selected && styles.filterChipSelected]}
    >
      {selected && <View style={styles.filterChipDot} />}
      <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>{label}</Text>
    </MotionButton>
  );
}

function ConversationRow({
  person,
  last,
  reduceMotion,
  avatarHidden,
  onPress,
}: {
  person: Person;
  last: boolean;
  reduceMotion: boolean;
  avatarHidden: boolean;
  onPress: (avatarRef: AvatarRef) => void;
}) {
  const avatarRef = useRef<View>(null);
  return (
    <View>
      <MotionButton
        onPress={() => onPress(avatarRef)}
        reduceMotion={reduceMotion}
        accessibilityLabel={`Open conversation with ${person.name}`}
        style={styles.conversationButton}
      >
        <View style={styles.conversationRow}>
          <Avatar ref={avatarRef} person={person} size={54} hidden={avatarHidden} />
          <View style={styles.conversationCopy}>
            <View style={styles.personNameRow}>
              <Text numberOfLines={1} style={styles.personName}>{person.name}</Text>
              {person.pinned && <Ionicons name="sparkles-outline" size={13} color={COLORS.lavender} />}
            </View>
            <Text numberOfLines={1} style={styles.lastMessage}>{person.lastMessage}</Text>
          </View>
          <View style={styles.conversationMeta}>
            <Text style={styles.messageTime}>{person.time}</Text>
            {person.unread > 0 ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{person.unread}</Text>
              </View>
            ) : (
              <View style={styles.readReceipt}>
                <Ionicons name="checkmark-done" size={15} color="#738099" />
              </View>
            )}
          </View>
        </View>
      </MotionButton>
      {!last && <View style={styles.rowDivider} />}
    </View>
  );
}

function BottomDock({
  insets,
  reduceMotion,
  onSearch,
  onCompose,
}: {
  insets: Insets;
  reduceMotion: boolean;
  onSearch: () => void;
  onCompose: () => void;
}) {
  return (
    <View
      style={[
        styles.dockWrap,
        {
          width: "100%",
          maxWidth: MAX_CONTENT_WIDTH,
          alignSelf: "center",
          paddingHorizontal: HORIZONTAL_GUTTER + insets.left,
          paddingBottom: Math.max(insets.bottom, 12),
        },
      ]}
    >
      <GlassSurface style={styles.dockSurface} radius={25}>
        <View style={styles.dockGroup}>
          <View style={styles.dockActiveItem}>
            <Ionicons name="chatbubbles" size={20} color={COLORS.lavender} />
            <Text style={styles.dockActiveLabel}>Chats</Text>
            <View style={styles.dockActivePip} />
          </View>
          <MotionButton
            accessibilityLabel="Search conversations"
            onPress={onSearch}
            reduceMotion={reduceMotion}
            style={styles.dockAction}
          >
            <Ionicons name="search-outline" size={21} color={COLORS.muted} />
            <Text style={styles.dockActionLabel}>Search</Text>
          </MotionButton>
          <MotionButton
            accessibilityLabel="Start a new chat"
            onPress={onCompose}
            reduceMotion={reduceMotion}
            style={styles.dockAction}
          >
            <View style={styles.dockPlusIcon}>
              <Ionicons name="add" size={21} color="#FFFFFF" />
            </View>
            <Text style={styles.dockActionLabel}>New chat</Text>
          </MotionButton>
        </View>
      </GlassSurface>
    </View>
  );
}

function ChatScreen({
  person,
  messages,
  isTyping,
  insets,
  reduceMotion,
  avatarHidden,
  onBack,
  onSend,
}: {
  person: Person;
  messages: ChatMessage[];
  isTyping: boolean;
  insets: Insets;
  reduceMotion: boolean;
  avatarHidden: boolean;
  onBack: () => void;
  onSend: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  const cleanDraft = draft.trim();

  useEffect(() => {
    const frame = requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    return () => cancelAnimationFrame(frame);
  }, [isTyping, messages.length]);

  const send = () => {
    if (!cleanDraft) return;
    onSend(cleanDraft);
    setDraft("");
  };

  return (
    <View style={styles.chatScreen}>
      <KeyboardAvoidingView
        style={[styles.chatKeyboardLayer, { width: "100%", maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center" }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <View
          style={[
            styles.chatHeader,
            {
              marginTop: insets.top + 12,
              paddingHorizontal: HORIZONTAL_GUTTER + insets.left,
            },
          ]}
        >
          <CircleIconButton name="chevron-back" label="Back to conversations" onPress={onBack} reduceMotion={reduceMotion} />
          <Avatar person={person} size={CHAT_AVATAR_SIZE} hidden={avatarHidden} />
          <View style={styles.chatHeaderCopy}>
            <Text style={styles.chatContactName}>{person.name}</Text>
            <View style={styles.chatPresenceLine}>
              <View style={[styles.presenceDot, !person.online && styles.presenceDotAway]} />
              <Text style={styles.chatPresenceText}>{person.online ? "here with you" : "around earlier"}</Text>
            </View>
          </View>
          <View style={styles.headerSparkle}>
            <Ionicons name="sparkles-outline" size={17} color={COLORS.lavender} />
          </View>
        </View>

        <View style={styles.chatContext}>
          <View style={styles.contextLine} />
          <Text style={styles.contextText}>A LITTLE POCKET OF THE INTERNET</Text>
          <View style={styles.contextLine} />
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.messageScroll}
          contentContainerStyle={[
            styles.messageContent,
            { paddingHorizontal: HORIZONTAL_GUTTER + insets.left },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.dateStamp}>
            <View style={styles.dateRule} />
            <Text style={styles.dateStampText}>TODAY, IN YOUR TIME</Text>
            <View style={styles.dateRule} />
          </View>
          {messages.map((message, index) => (
            <MessageBubble
              key={message.id}
              message={message}
              delay={index * 48}
              reduceMotion={reduceMotion}
            />
          ))}
          {isTyping && <TypingBubble reduceMotion={reduceMotion} />}
        </ScrollView>

        <View
          style={[
            styles.composerWrap,
            {
              paddingHorizontal: HORIZONTAL_GUTTER + insets.left,
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
        >
          <GlassSurface style={styles.composerSurface} radius={27}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Write a little something…"
              placeholderTextColor={COLORS.muted}
              selectionColor={COLORS.lavender}
              multiline
              maxLength={600}
              returnKeyType="send"
              blurOnSubmit={false}
              onSubmitEditing={send}
              style={styles.composerInput}
              accessibilityLabel={`Message ${person.name}`}
            />
            <MotionButton
              accessibilityLabel="Send message"
              onPress={send}
              disabled={!cleanDraft}
              reduceMotion={reduceMotion}
              style={[styles.sendButton, !cleanDraft && styles.sendButtonDisabled]}
            >
              <LinearGradient
                colors={cleanDraft ? ["#A996FF", "#6C75E8"] : ["#44485E", "#393D52"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sendButtonFill}
              >
                <Ionicons name="arrow-up" size={21} color="#FFFFFF" />
              </LinearGradient>
            </MotionButton>
          </GlassSurface>
          <Text style={styles.composerHint}>JUST BETWEEN YOU TWO</Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function MessageBubble({
  message,
  delay,
  reduceMotion,
}: {
  message: ChatMessage;
  delay: number;
  reduceMotion: boolean;
}) {
  const progress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 310,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [delay, progress, reduceMotion]);

  const animatedStyle = {
    opacity: progress,
    transform: [
      { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
      { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
    ],
  };
  const content = (
    <>
      <Text style={[styles.messageText, message.mine && styles.outgoingMessageText]}>{message.text}</Text>
      <View style={styles.messageFooter}>
        <Text style={[styles.messageTimestamp, message.mine && styles.outgoingTimestamp]}>{message.time}</Text>
        {message.mine && <Ionicons name="checkmark-done" size={14} color="#D8D0FF" />}
      </View>
    </>
  );

  return (
    <Animated.View
      style={[
        styles.messageBubblePosition,
        { alignSelf: message.mine ? "flex-end" : "flex-start" },
        animatedStyle,
      ]}
    >
      {message.mine ? (
        <LinearGradient
          colors={["#7770DF", "#554CA9"]}
          start={{ x: 0.05, y: 0 }}
          end={{ x: 0.95, y: 1 }}
          style={[styles.messageBubble, styles.outgoingBubble]}
        >
          {content}
        </LinearGradient>
      ) : (
        <GlassSurface style={[styles.messageBubble, styles.incomingBubble]} radius={22}>
          {content}
        </GlassSurface>
      )}
    </Animated.View>
  );
}

function TypingBubble({ reduceMotion }: { reduceMotion: boolean }) {
  const dots = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;
  useEffect(() => {
    if (reduceMotion) return;
    const loops = dots.map((dot, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 110),
          Animated.timing(dot, { toValue: 1, duration: 260, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 260, useNativeDriver: true }),
          Animated.delay(220),
        ]),
      ),
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [dots, reduceMotion]);

  return (
    <View style={[styles.typingBubblePosition, styles.typingBubbleRow]}>
      <GlassSurface style={styles.typingBubble} radius={19}>
        {dots.map((dot, index) => (
          <Animated.View
            key={index}
            style={[
              styles.typingDot,
              {
                opacity: reduceMotion ? 0.8 : dot.interpolate({ inputRange: [0, 1], outputRange: [0.42, 1] }),
                transform: reduceMotion
                  ? undefined
                  : [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }],
              },
            ]}
          />
        ))}
      </GlassSurface>
      <Text style={styles.typingLabel}>a reply is finding its way</Text>
    </View>
  );
}

function ComposeSheet({
  people,
  insets,
  height,
  progress,
  reduceMotion,
  onClose,
  onSelect,
}: {
  people: Person[];
  insets: Insets;
  height: number;
  progress: Animated.Value;
  reduceMotion: boolean;
  onClose: () => void;
  onSelect: (person: Person) => void;
}) {
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [height, 0] });
  return (
    <View style={styles.composeLayer}>
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: progress }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close new conversation panel"
          onPress={onClose}
          style={styles.composeScrim}
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.composeSheet,
          {
            height: Math.min(510, height * 0.82),
            width: "100%",
            maxWidth: MAX_CONTENT_WIDTH,
            alignSelf: "center",
            paddingBottom: Math.max(insets.bottom, 18),
            transform: [{ translateY }],
          },
        ]}
      >
        <BlurView intensity={46} tint="dark" style={StyleSheet.absoluteFillObject} />
        <LinearGradient
          colors={["rgba(31,36,61,0.97)", "rgba(17,22,39,0.985)"]}
          style={StyleSheet.absoluteFillObject}
        />
        <View pointerEvents="none" style={styles.sheetBorder} />
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeading}>
          <View>
            <Text style={styles.sheetEyebrow}>A GOOD PLACE TO START</Text>
            <Text style={styles.sheetTitle}>Who’s on your mind?</Text>
          </View>
          <CircleIconButton name="close" label="Close new chat" onPress={onClose} reduceMotion={reduceMotion} />
        </View>
        <Text style={styles.sheetSubheading}>Pick someone from your circle.</Text>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.composePeopleList}>
          {people.map((person) => (
            <MotionButton
              key={person.id}
              accessibilityLabel={`Start a chat with ${person.name}`}
              onPress={() => onSelect(person)}
              reduceMotion={reduceMotion}
              style={styles.composePersonButton}
            >
              <Avatar person={person} size={44} />
              <View style={styles.composePersonCopy}>
                <Text style={styles.composePersonName}>{person.name}</Text>
                <Text numberOfLines={1} style={styles.composePersonNote}>{person.note}</Text>
              </View>
              <Ionicons name="arrow-forward" size={17} color={COLORS.muted} />
            </MotionButton>
          ))}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const COLORS = {
  white: "#F8F7FF",
  muted: "#8A91A8",
  lavender: "#B5A5FF",
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0A0C17", overflow: "hidden" },
  screenLayer: { ...StyleSheet.absoluteFillObject },
  topGlow: {
    position: "absolute",
    top: -130,
    right: -115,
    width: 330,
    height: 330,
    borderRadius: 165,
    backgroundColor: "#44366F",
    opacity: 0.34,
  },
  sideGlow: {
    position: "absolute",
    top: 330,
    left: -190,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "#263B67",
    opacity: 0.25,
  },
  bottomGlow: {
    position: "absolute",
    bottom: -205,
    right: -80,
    width: 350,
    height: 350,
    borderRadius: 175,
    backgroundColor: "#263F48",
    opacity: 0.2,
  },
  inboxScreen: { flex: 1 },
  homeScrollViewport: { width: "100%", maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center", flex: 1 },
  homeContent: { paddingBottom: 18 },
  homeTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brandLockup: { flexDirection: "row", alignItems: "center", gap: 11 },
  brandMark: {
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#9886FF",
    shadowOpacity: 0.32,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  brandName: { color: COLORS.white, fontSize: 19, fontWeight: "700", letterSpacing: 0.2 },
  brandCaption: { color: COLORS.muted, fontSize: 8, letterSpacing: 1.45, marginTop: 1, fontWeight: "600" },
  homeTopRight: { flexDirection: "row", alignItems: "center", gap: 11 },
  onlineCountPill: {
    height: 31,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    gap: 7,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.055)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.075)",
  },
  onlinePip: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#79E1BC" },
  onlineCountText: { color: "#C5CAD9", fontSize: 10, fontWeight: "600" },
  avatarSurface: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderColor: "rgba(255,255,255,0.48)",
    borderWidth: 1,
  },
  avatarShine: {
    position: "absolute",
    top: -4,
    left: 4,
    borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.25)",
    transform: [{ rotate: "-24deg" }],
  },
  avatarInitials: { color: "rgba(255,255,255,0.96)", fontWeight: "700", letterSpacing: 0.4, textShadowColor: "rgba(20,15,45,0.2)", textShadowRadius: 4 },
  onlineIndicator: {
    position: "absolute",
    right: -1,
    bottom: 0,
    backgroundColor: "#76E2B6",
    borderWidth: 2,
    borderColor: "#121629",
  },
  heroBlock: { marginTop: 32, marginBottom: 29 },
  heroEyebrow: { color: "#9299AF", fontSize: 9, fontWeight: "700", letterSpacing: 2.05, marginBottom: 10 },
  heroTitle: { color: COLORS.white, fontSize: 35, lineHeight: 39, fontWeight: "700", letterSpacing: -0.8 },
  heroAccent: { color: "#BCAEFF" },
  heroCaption: { color: "#9299AF", fontSize: 12, lineHeight: 18, marginTop: 11, letterSpacing: 0.12 },
  sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 15 },
  sectionTitle: { color: COLORS.white, fontSize: 18, fontWeight: "600", letterSpacing: -0.2 },
  sectionSubtitle: { color: COLORS.muted, fontSize: 11, marginTop: 4 },
  messageCountPill: {
    height: 30,
    minWidth: 43,
    borderRadius: 16,
    paddingHorizontal: 9,
    gap: 5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(181,165,255,0.09)",
    borderWidth: 1,
    borderColor: "rgba(181,165,255,0.14)",
  },
  messageCountText: { color: "#D4CCFF", fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  glassSurface: {
    backgroundColor: "rgba(255,255,255,0.045)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    overflow: "hidden",
  },
  searchSurface: {
    height: 55,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    gap: 11,
  },
  searchInput: { flex: 1, color: COLORS.white, fontSize: 12, paddingVertical: 0 },
  searchHint: {
    width: 25,
    height: 23,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.11)",
    backgroundColor: "rgba(255,255,255,0.035)",
  },
  searchHintText: { color: COLORS.muted, fontSize: 14, marginTop: -2 },
  filterRow: { flexDirection: "row", gap: 8, marginTop: 15, marginBottom: 17 },
  filterChip: {
    height: 33,
    paddingHorizontal: 13,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.035)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.075)",
    gap: 6,
  },
  filterChipSelected: { backgroundColor: "rgba(181,165,255,0.13)", borderColor: "rgba(181,165,255,0.29)" },
  filterChipDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#C7B9FF" },
  filterChipText: { color: "#9299AF", fontSize: 10, fontWeight: "600" },
  filterChipTextSelected: { color: "#E2DCFF" },
  peoplePanel: { paddingVertical: 3 },
  conversationButton: { width: "100%" },
  conversationRow: { minHeight: 79, paddingHorizontal: 13, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  conversationCopy: { flex: 1, minWidth: 0 },
  personNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  personName: { flexShrink: 1, color: "#F6F5FC", fontSize: 13, fontWeight: "600" },
  lastMessage: { color: "#9399AE", fontSize: 10.5, lineHeight: 15, marginTop: 5 },
  conversationMeta: { minWidth: 39, alignItems: "flex-end", justifyContent: "center", alignSelf: "stretch", paddingVertical: 3 },
  messageTime: { color: "#82899F", fontSize: 9, fontWeight: "500" },
  unreadBadge: { minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#A996FF", marginTop: 10 },
  unreadBadgeText: { color: "#19142E", fontSize: 9, fontWeight: "800" },
  readReceipt: { marginTop: 9 },
  rowDivider: { height: StyleSheet.hairlineWidth, marginLeft: 79, marginRight: 13, backgroundColor: "rgba(255,255,255,0.075)" },
  emptySearch: { minHeight: 170, alignItems: "center", justifyContent: "center", padding: 22 },
  emptySearchTitle: { color: COLORS.white, fontSize: 14, fontWeight: "600", marginTop: 12 },
  emptySearchText: { color: COLORS.muted, fontSize: 11, marginTop: 5, textAlign: "center" },
  footerWhisper: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 20, marginBottom: 6 },
  footerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.08)" },
  footerWhisperText: { color: "#737B92", fontSize: 8, fontWeight: "700", letterSpacing: 1.35 },
  dockWrap: { paddingHorizontal: HORIZONTAL_GUTTER, paddingTop: 5 },
  dockSurface: { padding: 5 },
  dockGroup: { flexDirection: "row", alignItems: "center", justifyContent: "space-around", minHeight: 59 },
  dockActiveItem: { minWidth: 82, height: 51, alignItems: "center", justifyContent: "center", gap: 2 },
  dockActiveLabel: { color: "#DAD4FF", fontSize: 9, fontWeight: "700" },
  dockActivePip: { position: "absolute", bottom: -2, width: 15, height: 2, borderRadius: 2, backgroundColor: "#B5A5FF" },
  dockAction: { minWidth: 82, height: 51, alignItems: "center", justifyContent: "center", gap: 2 },
  dockActionLabel: { color: "#9198AD", fontSize: 9, fontWeight: "600" },
  dockPlusIcon: { width: 25, height: 25, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "#786DD2" },
  circleButtonHit: { width: 44, height: 44 },
  circleButtonSurface: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  chatScreen: { ...StyleSheet.absoluteFillObject },
  chatKeyboardLayer: { flex: 1 },
  chatHeader: { height: 48, flexDirection: "row", alignItems: "center", gap: CHAT_HEADER_GAP },
  chatHeaderCopy: { flex: 1, minWidth: 0, justifyContent: "center" },
  chatContactName: { color: COLORS.white, fontSize: 14, fontWeight: "700", letterSpacing: 0.1 },
  chatPresenceLine: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  presenceDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#75DDB4" },
  presenceDotAway: { backgroundColor: "#858BA1" },
  chatPresenceText: { color: "#9DA3B6", fontSize: 9, letterSpacing: 0.1 },
  headerSparkle: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 17, backgroundColor: "rgba(181,165,255,0.08)" },
  chatContext: { flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 24, marginTop: 23, marginBottom: 11 },
  contextLine: { height: StyleSheet.hairlineWidth, flex: 1, backgroundColor: "rgba(255,255,255,0.1)" },
  contextText: { color: "#717990", fontSize: 8, fontWeight: "700", letterSpacing: 1.15 },
  messageScroll: { flex: 1 },
  messageContent: { paddingTop: 16, paddingBottom: 20, flexGrow: 1 },
  dateStamp: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, marginTop: 5, marginBottom: 23 },
  dateRule: { width: 19, height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.11)" },
  dateStampText: { color: "#7D849A", fontSize: 8, fontWeight: "700", letterSpacing: 1.05 },
  messageBubblePosition: { maxWidth: "86%", marginBottom: 12 },
  messageBubble: { paddingHorizontal: 14, paddingTop: 11, paddingBottom: 8, borderRadius: 22, minWidth: 88 },
  incomingBubble: { borderColor: "rgba(255,255,255,0.13)", backgroundColor: "rgba(255,255,255,0.045)" },
  outgoingBubble: { borderWidth: 1, borderColor: "rgba(210,204,255,0.2)" },
  messageText: { color: "#F1F0F7", fontSize: 13, lineHeight: 19, letterSpacing: 0.03 },
  outgoingMessageText: { color: "#FFFFFF" },
  messageFooter: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 6 },
  messageTimestamp: { color: "#8990A5", fontSize: 8 },
  outgoingTimestamp: { color: "#D1CCF0" },
  typingBubblePosition: { alignSelf: "flex-start", marginBottom: 9 },
  typingBubbleRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  typingBubble: { height: 38, minWidth: 64, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 15 },
  typingDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#C0B3FF" },
  typingLabel: { color: "#777F96", fontSize: 9, fontStyle: "italic" },
  composerWrap: { paddingTop: 9 },
  composerSurface: { minHeight: 58, maxHeight: 130, flexDirection: "row", alignItems: "center", paddingHorizontal: 7, paddingVertical: 6, gap: 6 },
  composerInput: { flex: 1, maxHeight: 100, minHeight: 37, paddingHorizontal: 11, paddingTop: 8, paddingBottom: 8, color: COLORS.white, fontSize: 12, lineHeight: 18, textAlignVertical: "center" },
  sendButton: { width: 44, height: 44, borderRadius: 16, overflow: "hidden" },
  sendButtonDisabled: { opacity: 0.72 },
  sendButtonFill: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 16 },
  composerHint: { color: "#687087", fontSize: 8, fontWeight: "700", letterSpacing: 1.35, textAlign: "center", marginTop: 9 },
  avatarFlight: { position: "absolute", left: 0, top: 0, zIndex: 50, elevation: 50 },
  composeLayer: { ...StyleSheet.absoluteFillObject, zIndex: 30, elevation: 30, justifyContent: "flex-end" },
  composeScrim: { flex: 1, backgroundColor: "rgba(3,5,12,0.58)" },
  composeSheet: { position: "absolute", left: 0, right: 0, bottom: 0, borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: "hidden", paddingTop: 10, paddingHorizontal: 22, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" },
  sheetBorder: { ...StyleSheet.absoluteFillObject, borderTopLeftRadius: 32, borderTopRightRadius: 32, borderWidth: 1, borderColor: "rgba(255,255,255,0.11)" },
  sheetHandle: { alignSelf: "center", width: 37, height: 4, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.27)", marginBottom: 18 },
  sheetHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetEyebrow: { color: "#9B91C5", fontSize: 8, fontWeight: "700", letterSpacing: 1.6, marginBottom: 6 },
  sheetTitle: { color: COLORS.white, fontSize: 22, fontWeight: "700", letterSpacing: -0.4 },
  sheetSubheading: { color: COLORS.muted, fontSize: 11, marginTop: 5, marginBottom: 12 },
  composePeopleList: { paddingBottom: 4 },
  composePersonButton: { width: "100%", minHeight: 60, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 4, paddingVertical: 7 },
  composePersonCopy: { flex: 1, minWidth: 0 },
  composePersonName: { color: COLORS.white, fontSize: 12, fontWeight: "600" },
  composePersonNote: { color: COLORS.muted, fontSize: 10, marginTop: 4 },
});

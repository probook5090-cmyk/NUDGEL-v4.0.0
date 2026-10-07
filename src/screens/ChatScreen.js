import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { BlurTargetView } from 'expo-blur';
import ChatIcon from '../components/ChatIcon';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import GlassBlurContext from '../GlassBlurContext';
import ChatBubble from '../components/ChatBubble';
import ContactAvatar from '../components/ContactAvatar';
import GlassSurface from '../components/GlassSurface';
import { useChatTheme } from '../theme';

const coastPhoto = require('../../assets/coast.jpg');

const starterMessages = [
  {
    id: 'mira-1',
    type: 'text',
    text: 'Saturday, somewhere like this?',
    mine: false,
    showAvatar: true,
  },
  {
    id: 'mira-2',
    type: 'text',
    text: 'No plans. Just us.',
    mine: true,
  },
  {
    id: 'mira-3',
    type: 'photo',
    caption: 'A place to disappear',
    mine: false,
    showAvatar: true,
  },
  {
    id: 'mira-4',
    type: 'text',
    text: 'A little farther from everything.',
    mine: false,
  },
];

const sampleReplies = [
  'That sounds like my kind of plan. ✨',
  'I’ll bring the good coffee. ☕',
  'Then we take the long way home.',
];

export default function ChatScreen() {
  const theme = useChatTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [messages, setMessages] = useState(starterMessages);
  const [draft, setDraft] = useState('');
  const [inputHeight, setInputHeight] = useState(44);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const blurTarget = useRef(null);
  const timers = useRef([]);
  const sequence = useRef(0);
  const replySequence = useRef(0);
  const canSend = !!draft.trim();

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    },
    []
  );

  const scrollToLatest = useCallback(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const scheduleReply = useCallback(() => {
    const reply = sampleReplies[replySequence.current % sampleReplies.length];
    replySequence.current += 1;
    const timer = setTimeout(() => {
      timers.current = timers.current.filter((entry) => entry !== timer);
      setMessages((current) => [
        ...current,
        {
          id: `reply-${Date.now()}-${sequence.current++}`,
          type: 'text',
          text: reply,
          mine: false,
          showAvatar: true,
        },
      ]);
    }, 950);
    timers.current.push(timer);
  }, []);

  const sendText = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    setMessages((current) => [
      ...current,
      {
        id: `local-${Date.now()}-${sequence.current++}`,
        type: 'text',
        text,
        mine: true,
      },
    ]);
    setDraft('');
    setInputHeight(44);
    setAttachmentsOpen(false);
    scheduleReply();
    requestAnimationFrame(() => {
      scrollToLatest();
      inputRef.current?.focus();
    });
  }, [draft, scheduleReply, scrollToLatest]);

  const sendPhoto = useCallback(() => {
    setMessages((current) => [
      ...current,
      {
        id: `photo-${Date.now()}-${sequence.current++}`,
        type: 'photo',
        caption: 'A little escape',
        mine: true,
      },
    ]);
    setAttachmentsOpen(false);
    Keyboard.dismiss();
    scheduleReply();
    scrollToLatest();
  }, [scheduleReply, scrollToLatest]);

  const toggleReaction = useCallback((id) => {
    setMessages((current) =>
      current.map((message) =>
        message.id === id ? { ...message, reaction: message.reaction ? null : '❤️' } : message
      )
    );
  }, []);

  const resetConversation = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    sequence.current = 0;
    replySequence.current = 0;
    setMessages(starterMessages);
    setDraft('');
    setInputHeight(44);
    setAttachmentsOpen(false);
    setPhotoOpen(false);
    Keyboard.dismiss();
  }, []);

  const openOptions = () => {
    Keyboard.dismiss();
    Alert.alert(
      'Conversation options',
      'This is a local preview. Messages do not leave your device.',
      [
        { text: 'Reset demo chat', style: 'destructive', onPress: resetConversation },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const openContactInfo = () => {
    Alert.alert('Mira Ellis', 'In your circle · Sample conversation');
  };

  const goToStart = () => {
    Keyboard.dismiss();
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  return (
    <GlassBlurContext.Provider value={blurTarget}>
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: theme.background }]}
        edges={['top', 'left', 'right']}
      >
        <StatusBar
          barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'}
          backgroundColor={theme.background}
        />
        <BlurTargetView
          ref={blurTarget}
          collapsable={false}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        >
          <LinearGradient
            colors={[theme.backgroundTop, theme.background, theme.backgroundBottom]}
            start={{ x: 0.12, y: 0 }}
            end={{ x: 0.88, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              styles.ambientGlow,
              {
                top: 56,
                right: -126,
                backgroundColor:
                  theme.mode === 'dark' ? 'rgba(95,128,137,0.13)' : 'rgba(211,224,222,0.48)',
              },
            ]}
          />
          <View
            style={[
              styles.ambientGlow,
              {
                bottom: 134,
                left: -158,
                backgroundColor:
                  theme.mode === 'dark' ? 'rgba(111,99,122,0.10)' : 'rgba(229,223,216,0.52)',
              },
            ]}
          />
        </BlurTargetView>

        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Jump to the beginning of the conversation"
            onPress={goToStart}
            style={styles.headerButtonTouch}
          >
            <GlassSurface radius={28} style={styles.headerButton}>
              <ChatIcon name="back" size={23} color={theme.icon} />
            </GlassSurface>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mira Ellis contact details"
            onPress={openContactInfo}
            style={styles.contactHeading}
          >
            <ContactAvatar size={49} />
            <View style={styles.contactText}>
              <Text numberOfLines={1} style={[styles.contactName, { color: theme.text }]}>
                Mira Ellis
              </Text>
              <Text numberOfLines={1} style={[styles.contactStatus, { color: theme.muted }]}>
                In your circle
              </Text>
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Conversation options"
            onPress={openOptions}
            style={styles.headerButtonTouch}
          >
            <GlassSurface radius={28} style={styles.headerButton}>
              <ChatIcon name="more" size={22} color={theme.icon} />
            </GlassSurface>
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={styles.conversation}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            ref={scrollRef}
            style={styles.messagesScroll}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            onContentSizeChange={scrollToLatest}
          >
            <View style={styles.datePill}>
              <Text style={[styles.dateText, { color: theme.muted }]}>Today</Text>
            </View>
            {messages.map((item) => (
              <ChatBubble
                key={item.id}
                item={item}
                width={width - 36}
                onLongPress={toggleReaction}
                onReactionPress={toggleReaction}
                onPhotoPress={() => setPhotoOpen(true)}
              />
            ))}
          </ScrollView>

          {attachmentsOpen ? (
            <View style={styles.attachmentDock}>
              <GlassSurface radius={25} style={styles.attachmentCard}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Send the coastal photo"
                  onPress={sendPhoto}
                  style={styles.attachmentPreview}
                >
                  <Image source={coastPhoto} resizeMode="cover" style={styles.attachmentImage} />
                  <View style={styles.attachmentCopy}>
                    <Text style={[styles.attachmentTitle, { color: theme.text }]}>
                      A little escape
                    </Text>
                    <Text style={[styles.attachmentSubtitle, { color: theme.muted }]}>
                      Share the coast with Mira
                    </Text>
                  </View>
                  <ChatIcon name="send-circle" size={35} color={theme.text} />
                </Pressable>
              </GlassSurface>
            </View>
          ) : null}

          <View
            style={[
              styles.composerDock,
              { paddingBottom: keyboardVisible ? 8 : Math.max(insets.bottom, 12) },
            ]}
          >
            <View style={styles.composerRow}>
              <GlassSurface radius={32} style={styles.composerPill}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={attachmentsOpen ? 'Close attachments' : 'Add a photo'}
                  onPress={() => {
                    Keyboard.dismiss();
                    setAttachmentsOpen((open) => !open);
                  }}
                  style={styles.composerIconButton}
                >
                  <ChatIcon
                    name={attachmentsOpen ? 'close' : 'plus'}
                    size={28}
                    color={theme.icon}
                  />
                </Pressable>
                <TextInput
                  ref={inputRef}
                  accessibilityLabel="Message Mira"
                  placeholder="Say something good…"
                  placeholderTextColor={theme.muted}
                  value={draft}
                  onChangeText={setDraft}
                  onFocus={() => setAttachmentsOpen(false)}
                  onContentSizeChange={(event) => {
                    const next = Math.max(44, Math.min(104, event.nativeEvent.contentSize.height));
                    setInputHeight(next);
                  }}
                  multiline
                  scrollEnabled={inputHeight >= 104}
                  textAlignVertical="center"
                  returnKeyType="default"
                  blurOnSubmit={false}
                  style={[
                    styles.messageInput,
                    {
                      height: inputHeight,
                      color: theme.text,
                    },
                  ]}
                />
              </GlassSurface>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Send message"
                disabled={!canSend}
                onPress={sendText}
                style={[styles.sendButtonTouch, !canSend && styles.sendDisabled]}
              >
                <GlassSurface
                  tone={canSend ? 'outgoing' : 'neutral'}
                  radius={29}
                  style={styles.sendButton}
                >
                  <ChatIcon name="send" size={25} color={canSend ? theme.text : theme.muted} />
                </GlassSurface>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>

        <Modal
          visible={photoOpen}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => setPhotoOpen(false)}
        >
          <View style={[styles.photoModal, { backgroundColor: theme.overlay }]}>
            <Pressable
              accessibilityLabel="Close photo"
              onPress={() => setPhotoOpen(false)}
              style={StyleSheet.absoluteFill}
            />
            <SafeAreaView style={styles.photoModalSafe} edges={['top', 'bottom']}>
              <View style={styles.photoModalHeader}>
                <Text style={styles.photoModalTitle}>A place to disappear</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close photo"
                  onPress={() => setPhotoOpen(false)}
                  style={styles.modalCloseTouch}
                >
                  <View style={styles.modalClose}>
                    <ChatIcon name="close" size={22} color="#FFFFFF" />
                  </View>
                </Pressable>
              </View>
              <Image
                source={coastPhoto}
                resizeMode="contain"
                style={{
                  width: width - 28,
                  height: Math.min((width - 28) / 1.46, height * 0.65),
                  alignSelf: 'center',
                  borderRadius: 28,
                }}
              />
              <Text style={styles.photoModalCaption}>Shared by Mira Ellis · Today</Text>
            </SafeAreaView>
          </View>
        </Modal>
      </SafeAreaView>
    </GlassBlurContext.Provider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    overflow: 'hidden',
  },
  ambientGlow: {
    position: 'absolute',
    width: 290,
    height: 290,
    borderRadius: 145,
    opacity: 0.78,
  },
  header: {
    minHeight: 78,
    paddingHorizontal: 17,
    paddingTop: 7,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    zIndex: 2,
  },
  headerButtonTouch: {
    width: 54,
    height: 54,
  },
  headerButton: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.055,
    elevation: 3,
  },
  contactHeading: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 11,
    paddingHorizontal: 2,
    minHeight: 54,
  },
  contactText: {
    flexShrink: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: 3,
  },
  contactName: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
    letterSpacing: -0.45,
  },
  contactStatus: {
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.1,
  },
  conversation: {
    flex: 1,
  },
  messagesScroll: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 18,
    paddingTop: 19,
    paddingBottom: 16,
  },
  datePill: {
    alignSelf: 'center',
    paddingHorizontal: 13,
    paddingVertical: 6,
    marginBottom: 31,
  },
  dateText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.9,
  },
  attachmentDock: {
    paddingHorizontal: 15,
    paddingBottom: 7,
  },
  attachmentCard: {
    padding: 10,
    borderRadius: 25,
  },
  attachmentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
  },
  attachmentImage: {
    width: 62,
    height: 52,
    borderRadius: 15,
  },
  attachmentCopy: {
    flex: 1,
    gap: 4,
  },
  attachmentTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  attachmentSubtitle: {
    fontSize: 11,
  },
  composerDock: {
    paddingHorizontal: 15,
    paddingTop: 9,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  composerPill: {
    flex: 1,
    minHeight: 60,
    maxHeight: 122,
    paddingHorizontal: 6,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    borderRadius: 32,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 5,
  },
  composerIconButton: {
    width: 45,
    height: 45,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 23,
  },
  messageInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 104,
    paddingHorizontal: 5,
    paddingTop: 10,
    paddingBottom: 8,
    fontSize: 16,
    lineHeight: 22,
    includeFontPadding: false,
  },
  sendButtonTouch: {
    width: 58,
    height: 58,
  },
  sendButton: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.07,
    elevation: 4,
  },
  sendDisabled: {
    opacity: 0.78,
  },
  photoModal: {
    flex: 1,
    justifyContent: 'center',
  },
  photoModalSafe: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  photoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
  },
  photoModalTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowRadius: 8,
  },
  modalCloseTouch: {
    width: 46,
    height: 46,
  },
  modalClose: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.19)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.36)',
  },
  photoModalCaption: {
    alignSelf: 'center',
    marginTop: 15,
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    letterSpacing: 0.2,
  },
});

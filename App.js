import React from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

const chats = [
  {
    id: 'mara',
    name: 'Mara',
    initials: 'M',
    color: '#F4D9D5',
    message: 'You always know how to make my day.',
    time: '10:42',
    unread: 2,
    online: true,
  },
  {
    id: 'mom',
    name: 'Mom',
    initials: 'M',
    color: '#F6E5B8',
    message: 'Call me when you get a minute',
    time: '9:18',
    sent: true,
  },
  {
    id: 'fable',
    name: 'Fable',
    initials: 'F',
    color: '#E6DDF8',
    message: 'The little things matter most. ✨',
    time: 'Yesterday',
    unread: 1,
  },
  {
    id: 'riya',
    name: 'Riya',
    initials: 'R',
    color: '#D7E9E2',
    message: 'Voice message · 0:18',
    time: 'Yesterday',
    sent: true,
  },
  {
    id: 'arjun',
    name: 'Arjun',
    initials: 'A',
    color: '#D7E5F5',
    message: 'Coffee this weekend? ☕',
    time: 'Tue',
  },
  {
    id: 'family',
    name: 'Family group',
    initials: 'FG',
    color: '#F1D8E8',
    message: 'Nina: Saturday at 6 works for everyone',
    time: 'Tue',
    unread: 4,
    group: true,
  },
  {
    id: 'kabir',
    name: 'Kabir',
    initials: 'K',
    color: '#D8E6C7',
    message: 'Photo · 2 images',
    time: 'Mon',
    sent: true,
  },
  {
    id: 'studio',
    name: 'Studio friends',
    initials: 'SF',
    color: '#F3DEC9',
    message: 'Aanya: sent the playlist 🎧',
    time: 'Mon',
    group: true,
  },
];

function SearchGlyph() {
  return (
    <View style={styles.searchGlyph}>
      <View style={styles.searchLens} />
      <View style={styles.searchHandle} />
    </View>
  );
}

function ChatRow({ chat }) {
  return (
    <View style={styles.chatRow}>
      <View style={[styles.avatar, { backgroundColor: chat.color }]}>
        <Text style={[styles.avatarText, chat.initials.length > 1 && styles.groupAvatarText]}>
          {chat.initials}
        </Text>
        {chat.online && <View style={styles.onlineDot} />}
      </View>

      <View style={styles.chatCopy}>
        <View style={styles.chatTopLine}>
          <Text numberOfLines={1} style={styles.contactName}>
            {chat.name}
          </Text>
          <Text style={[styles.time, chat.unread && styles.unreadTime]}>{chat.time}</Text>
        </View>
        <View style={styles.chatBottomLine}>
          <Text numberOfLines={1} style={styles.preview}>
            {chat.sent && <Text style={styles.readTicks}>✓✓ </Text>}
            {chat.message}
          </Text>
          {chat.unread ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadCount}>{chat.unread}</Text>
            </View>
          ) : chat.group ? (
            <Text style={styles.groupMark}>GROUP</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function ChatHome() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAF9" />
      <View style={styles.header}>
        <View style={styles.brandLockup}>
          <View style={styles.brandMark}>
            <View style={styles.brandMarkDot} />
          </View>
          <Text style={styles.brandName}>nudgel</Text>
        </View>
        <View style={styles.headerActions}>
          <View style={styles.headerIcon}>
            <SearchGlyph />
          </View>
          <View style={styles.headerIcon}>
            <Text style={styles.moreGlyph}>⋮</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.eyebrow}>YOUR PEOPLE</Text>
            <Text style={styles.title}>Chats</Text>
          </View>
          <View style={styles.totalBadge}>
            <Text style={styles.totalBadgeText}>08</Text>
          </View>
        </View>

        <View style={styles.searchBar}>
          <SearchGlyph />
          <Text style={styles.searchPlaceholder}>Search chats</Text>
          <View style={styles.searchShortcut}>
            <Text style={styles.searchShortcutText}>⌕</Text>
          </View>
        </View>

        <View style={styles.filters}>
          <View style={styles.filterSelected}>
            <Text style={styles.filterSelectedText}>All</Text>
          </View>
          <View style={styles.filter}>
            <Text style={styles.filterText}>Unread</Text>
            <View style={styles.filterCount}>
              <Text style={styles.filterCountText}>3</Text>
            </View>
          </View>
          <View style={styles.filter}>
            <Text style={styles.filterText}>Groups</Text>
          </View>
        </View>

        <View style={styles.listHeading}>
          <Text style={styles.listHeadingText}>RECENT</Text>
          <Text style={styles.listHeadingMeta}>8 chats</Text>
        </View>

        <View style={styles.chatList}>
          {chats.map((chat) => (
            <ChatRow key={chat.id} chat={chat} />
          ))}
        </View>
        <Text style={styles.endNote}>You’re all caught up to here</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ChatHome />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAF9',
  },
  header: {
    minHeight: 58,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandLockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandMark: {
    width: 25,
    height: 25,
    borderRadius: 9,
    backgroundColor: '#137B64',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-8deg' }],
  },
  brandMarkDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#E7F5EE',
    marginLeft: 3,
  },
  brandName: {
    color: '#17352D',
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDF1EF',
  },
  moreGlyph: {
    color: '#344741',
    fontSize: 21,
    lineHeight: 25,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 13,
    paddingBottom: 22,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 19,
  },
  eyebrow: {
    color: '#82908A',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.7,
    marginBottom: 3,
  },
  title: {
    color: '#14231F',
    fontSize: 31,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -1.2,
  },
  totalBadge: {
    height: 27,
    minWidth: 32,
    paddingHorizontal: 8,
    marginBottom: 4,
    borderRadius: 10,
    backgroundColor: '#E5F2EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalBadgeText: {
    color: '#17745E',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  searchBar: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    borderRadius: 16,
    backgroundColor: '#EEF2F0',
    marginBottom: 16,
  },
  searchGlyph: {
    width: 17,
    height: 17,
    position: 'relative',
    marginRight: 11,
  },
  searchLens: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.8,
    borderColor: '#7C8984',
  },
  searchHandle: {
    position: 'absolute',
    width: 6,
    height: 1.8,
    backgroundColor: '#7C8984',
    right: 0,
    bottom: 2,
    transform: [{ rotate: '45deg' }],
    borderRadius: 1,
  },
  searchPlaceholder: {
    color: '#89948F',
    fontSize: 14,
    flex: 1,
  },
  searchShortcut: {
    width: 23,
    height: 23,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchShortcutText: {
    color: '#7C8984',
    fontSize: 18,
    lineHeight: 21,
  },
  filters: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  filterSelected: {
    height: 34,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#17745E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterSelectedText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  filter: {
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8EEEB',
  },
  filterText: {
    color: '#62716B',
    fontSize: 12,
    fontWeight: '600',
  },
  filterCount: {
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: '#E7F1EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterCountText: {
    color: '#17745E',
    fontSize: 9,
    fontWeight: '800',
  },
  listHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  listHeadingText: {
    color: '#89958F',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  listHeadingMeta: {
    color: '#A1AAA6',
    fontSize: 11,
    fontWeight: '600',
  },
  chatList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 21,
    paddingHorizontal: 13,
    marginTop: 9,
    borderWidth: 1,
    borderColor: '#F0F3F1',
    shadowColor: '#18352D',
    shadowOpacity: 0.035,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },
  chatRow: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  avatar: {
    width: 49,
    height: 49,
    marginRight: 12,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarText: {
    color: '#29463D',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  groupAvatarText: {
    fontSize: 13,
  },
  onlineDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#39A878',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  chatCopy: {
    flex: 1,
    minWidth: 0,
    paddingBottom: 1,
  },
  chatTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  contactName: {
    flex: 1,
    color: '#17251F',
    fontSize: 14,
    fontWeight: '700',
    marginRight: 8,
  },
  time: {
    color: '#9AA49F',
    fontSize: 10,
    fontWeight: '600',
  },
  unreadTime: {
    color: '#21856B',
  },
  chatBottomLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  preview: {
    flex: 1,
    color: '#89958F',
    fontSize: 11,
    lineHeight: 16,
  },
  readTicks: {
    color: '#21856B',
    fontSize: 10,
    fontWeight: '800',
  },
  unreadBadge: {
    minWidth: 19,
    height: 19,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: '#21856B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadCount: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  groupMark: {
    color: '#A2ACA7',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  endNote: {
    color: '#A4AEAA',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 17,
  },
});

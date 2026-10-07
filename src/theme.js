import { useColorScheme } from 'react-native';

const lightTheme = {
  mode: 'light',
  background: '#F1F2F1',
  backgroundTop: '#F6F5F2',
  backgroundBottom: '#EAEEED',
  text: '#191B1D',
  muted: '#858A8D',
  subtle: '#A8ACAE',
  incoming: 'rgba(255,255,255,0.68)',
  outgoing: 'rgba(219,231,234,0.72)',
  glassBorder: 'rgba(255,255,255,0.78)',
  glassHighlight: 'rgba(255,255,255,0.78)',
  icon: '#17191B',
  send: '#FDFEFD',
  overlay: 'rgba(21,27,29,0.34)',
};

const darkTheme = {
  mode: 'dark',
  background: '#191B1D',
  backgroundTop: '#242628',
  backgroundBottom: '#17191B',
  text: '#F4F5F5',
  muted: '#A2A7AA',
  subtle: '#73797C',
  incoming: 'rgba(49,52,55,0.74)',
  outgoing: 'rgba(74,94,103,0.68)',
  glassBorder: 'rgba(255,255,255,0.16)',
  glassHighlight: 'rgba(255,255,255,0.23)',
  icon: '#F4F5F5',
  send: 'rgba(255,255,255,0.16)',
  overlay: 'rgba(0,0,0,0.68)',
};

export function useChatTheme() {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkTheme : lightTheme;
}

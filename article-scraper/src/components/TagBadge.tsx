import { Text, View, StyleSheet, useColorScheme } from 'react-native';
import { Colors } from '../constants/Colors';

interface Props {
  tag: string;
  small?: boolean;
}

export function TagBadge({ tag, small }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View style={[styles.badge, { backgroundColor: colors.tag }]}>
      <Text
        style={[
          styles.text,
          { color: colors.tagText },
          small && styles.textSmall,
        ]}
      >
        #{tag}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  text: { fontSize: 13, fontWeight: '600' },
  textSmall: { fontSize: 11 },
});

import { Tabs } from 'expo-router';
import { Image } from 'react-native';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: true }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Scores',
          tabBarIcon: ({ color, size }) => (
            <Image source={require('@/assets/images/tabIcons/home.png')} style={{ width: size, height: size, tintColor: color }} />
          ),
        }}
      />
      <Tabs.Screen
        name="standings"
        options={{
          title: 'Standings',
          tabBarIcon: ({ color, size }) => (
            <Image source={require('@/assets/images/tabIcons/explore.png')} style={{ width: size, height: size, tintColor: color }} />
          ),
        }}
      />
    </Tabs>
  );
}

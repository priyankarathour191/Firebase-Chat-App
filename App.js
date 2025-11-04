import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, ActivityIndicator } from 'react-native';

import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

import LoginScreen from './src/screens/LoginScreen';
import ChatScreen from './src/screens/ChatScreen';
import ChatListScreen from './src/screens/ChatListScreen';
import { requestAndroidNotificationPermission } from './src/config/firebase';

const Stack = createNativeStackNavigator();

const App = () => {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);
  const [phoneVerified, setPhoneVerified] = useState(false);

  useEffect(() => {
  requestAndroidNotificationPermission();
}, []);
  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(async (user) => {
      console.log('🔐 Auth state changed:', user ? `User logged in (${user.uid})` : 'No user');
      
      if (user) {
        setUser(user);
        
        try {
          const userDoc = await firestore().collection('users').doc(user.uid).get();
          
          if (userDoc.exists) {
            const userData = userDoc.data();
            const isPhoneVerified = userData.phoneVerified || false;
            setPhoneVerified(isPhoneVerified);
            console.log('📱 Phone verification status:', isPhoneVerified);
          } else {
            console.log('📝 User document does not exist in Firestore');
            setPhoneVerified(false);
          }
        } catch (error) {
          console.log('❌ Error checking phone verification:', error);
          setPhoneVerified(false);
        }
      } else {
        setUser(null);
        setPhoneVerified(false);
      }
      
      setInitializing(false);
    });

    return unsubscribe;
  }, []);

  if (initializing) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center',
        backgroundColor: '#fff'
      }}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ marginTop: 16, fontSize: 16, color: '#666' }}>
          Checking authentication...
        </Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName={user ? "ChatListScreen" : "Login"}
      >
        {user ? (
          <>
            <Stack.Screen 
              name="ChatListScreen" 
              component={ChatListScreen}
              options={{ 
                title: 'Messages', 
                headerShown: true,
                headerLeft: () => null,
                gestureEnabled: false
              }}
            />
            <Stack.Screen 
              name="ChatScreen" 
              component={ChatScreen}
              options={({ route }) => ({ 
                title: route.params?.user?.displayName || 'Chat',
                headerShown: true 
              })}
            />
          </>
        ) : (
          <Stack.Screen 
            name="Login" 
            component={LoginScreen} 
            options={{ 
              headerShown: false,
              gestureEnabled: false
            }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default App;
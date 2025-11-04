// src/screens/ChatListScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
  Button,
  RefreshControl,
  Image
} from 'react-native';
import { auth, subscribeToUsers, firestore, fixUserData } from '../config/firebase';
import { SafeAreaView } from 'react-native-safe-area-context';

const ChatListScreen = ({ navigation }) => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const currentUser = auth().currentUser;
const [refreshing, setRefreshing] = useState(false);
const onRefresh = async () => {
  try {
    setRefreshing(true);
    await fixCurrentUserData(); 

    const unsubscribe = subscribeToUsers((usersList) => {
      const validUsers = usersList.filter(user => 
        user.uid && user.displayName && user.email && user.uid !== currentUser.uid
      );

      setUsers(validUsers);
      setFilteredUsers(validUsers);
    }, currentUser.uid);

    setTimeout(() => {
      unsubscribe();
      setRefreshing(false);
    }, 1000);

  } catch (e) {
    setRefreshing(false);
  }
};

 

  const fixCurrentUserData = async () => {
    try {
      if (!currentUser) return;

      console.log('🔄 Fixing current user data...');
      await fixUserData(currentUser);
      
      
    } catch (error) {
      console.error('Error fixing user data:', error);
      Alert.alert('Error', error.message);
    }
  };


  useEffect(() => {
    if (!currentUser) {
      navigation.replace('Login');
      return;
    }

    
    fixCurrentUserData();

    const unsubscribe = subscribeToUsers((usersList) => {
   
      const validUsers = usersList.filter(user => 
        user.uid && user.displayName && user.email && user.uid !== currentUser.uid
      );
      
      console.log('Valid users count (after additional filter):', validUsers.length);
      console.log('Valid users:', validUsers.map(u => ({
        name: u.displayName,
        email: u.email,
        uid: u.uid
      })));
      
      setUsers(validUsers);
      setFilteredUsers(validUsers);
      setLoading(false);
    }, currentUser.uid); 
    return () => unsubscribe();
  }, [currentUser, navigation]);
  const handleSignOut = async () => {
    try {
      Alert.alert(
        'Sign Out',
        'Are you sure you want to sign out?',
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Sign Out',
            style: 'destructive',
            onPress: async () => {
              await auth().signOut();
              navigation.replace('Login');
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers(users);
    } else {
      const filtered = users.filter(user =>
        user.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredUsers(filtered);
    }
  }, [searchQuery, users]);
  const renderAvatar = (user) => {
    if (user.photoURL) {
      return (
        <Image
          source={{ uri: user.photoURL }}
          style={styles.avatarImage}
          onError={(error) => {
            console.log('Error loading image for:', user.displayName, error);
          }}
        />
      );
    }
    
    return (
      <View style={styles.avatarFallback}>
        <Text style={styles.avatarText}>
          {user.displayName?.charAt(0)?.toUpperCase() || 'U'}
        </Text>
      </View>
    );
  };

  const renderUserItem = ({ item }) => (
     <TouchableOpacity
      style={styles.userItem}
      onPress={() => navigation.navigate('ChatScreen', { user: item })}
    >
      <View style={styles.avatarContainer}>
        {renderAvatar(item)}
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.displayName}</Text>
        <Text style={styles.userEmail}>{item.email}</Text>
      
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading users...</Text>
        
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      
      
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search users..."
          value={searchQuery}
          placeholderTextColor='gray'
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.debugInfo}>
        <Text style={styles.debugText}>
          Valid Users: {users.length} 
        </Text>
      </View>

      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.uid}
        renderItem={renderUserItem}
          refreshControl={
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
  }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No valid users found</Text>
          
          </View>
        }
      />
      <View style={{alignItems:'flex-end',padding:20}}>
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
          </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
   signOutButton: {
    height:40,
    width:90,
    backgroundColor: '#FF3B30',
    paddingHorizontal: 16,
    marginBottom:5,
    paddingVertical: 8,
    borderRadius: 6,
  },
  signOutText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonSpacer: {
    width: 10,
  },
  searchContainer: {
    padding: 16,
  },
  searchInput: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: 'black ',
    fontSize: 16,
  },
  debugInfo: {
    padding: 8,
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  debugText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
    avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    marginRight: 12,
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarFallback: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  syncingText: {
    fontSize: 14,
    color: '#999',
    marginBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 20,
  },
});

export default ChatListScreen;
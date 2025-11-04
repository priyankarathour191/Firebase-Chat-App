import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  Keyboard,
} from 'react-native';
import { auth, firestore } from '../config/firebase';
import { SafeAreaView } from 'react-native-safe-area-context';

const ChatScreen = ({ route, navigation }) => {
  const { user: recipient } = route.params;
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const flatListRef = useRef(null);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  const getChatRoomId = (userId1, userId2) => {
    if (!userId1 || !userId2) {
      console.error('Missing user IDs for chat room');
      return null;
    }
    const sortedIds = [userId1, userId2].sort();
    const chatRoomId = sortedIds.join('_');
    console.log('Chat Room ID:', chatRoomId, 'User1:', userId1, 'User2:', userId2);
    return chatRoomId;
  };

  useEffect(() => {
    const user = auth().currentUser;
    if (user) {
      console.log('Current user loaded:', user.uid, user.displayName);
      setCurrentUser(user);
    }

    const unsubscribe = auth().onAuthStateChanged((user) => {
      if (user) {
        console.log('Auth state changed:', user.uid);
        setCurrentUser(user);
      } else {
        navigation.replace('Login');
      }
    });

    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (!currentUser || !recipient || !recipient.uid) {
      console.warn('Missing user data:', { 
        currentUser: currentUser?.uid, 
        recipient: recipient?.uid 
      });
      return;
    }

    const chatRoomId = getChatRoomId(currentUser.uid, recipient.uid);
    if (!chatRoomId) {
      console.error('Could not generate chat room ID');
      return;
    }

    console.log('Setting up message listener for chat room:', chatRoomId);

    const messagesRef = firestore()
      .collection('chats')
      .doc(chatRoomId)
      .collection('messages');
    
    const unsubscribe = messagesRef
      .orderBy('timestamp', 'asc')
      .onSnapshot(
        (snapshot) => {
          const messagesList = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            messagesList.push({ 
              id: doc.id, 
              ...data,
              timestamp: data.timestamp || { seconds: Date.now() / 1000 }
            });
          });
          
          console.log(`Received ${messagesList.length} messages in chat room ${chatRoomId}`);
          setMessages(messagesList);
          
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }, 
        (error) => {
          console.error('Error listening to messages:', error);
          Alert.alert('Error', 'Failed to load messages: ' + error.message);
        }
      );

    return () => {
      console.log('Cleaning up message listener');
      unsubscribe();
    };
  }, [currentUser, recipient]);

  const sendMessage = async () => {
    if (!newMessage.trim()) {
      console.log('Empty message, not sending');
      return;
    }
    
    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to send messages');
      return;
    }

    if (!recipient || !recipient.uid) {
      Alert.alert('Error', 'Invalid recipient');
      return;
    }

    const messageText = newMessage.trim();
    setNewMessage(''); 
    setLoading(true);
    
    try {
      const chatRoomId = getChatRoomId(currentUser.uid, recipient.uid);
      if (!chatRoomId) {
        throw new Error('Could not create chat room ID');
      }


      const chatRoomRef = firestore().collection('chats').doc(chatRoomId);
      const messagesRef = chatRoomRef.collection('messages');
            const messageData = {
        text: messageText,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Unknown',
        timestamp: firestore.FieldValue.serverTimestamp(),
        read: false,
      };

      
      const messageRef = await messagesRef.add(messageData);

      const chatRoomSnap = await chatRoomRef.get();
      
      const chatRoomData = {
        participants: [currentUser.uid, recipient.uid],
        participantNames: {
          [currentUser.uid]: currentUser.displayName || currentUser.email?.split('@')[0] || 'Unknown',
          [recipient.uid]: recipient.displayName || recipient.email?.split('@')[0] || 'Unknown',
        },
        lastMessage: {
          text: messageText,
          senderId: currentUser.uid,
          timestamp: firestore.FieldValue.serverTimestamp(),
        },
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };

      if (!chatRoomSnap.exists()) {
        console.log('Creating new chat room');
        await chatRoomRef.set({
          ...chatRoomData,
          createdAt: firestore.FieldValue.serverTimestamp(),
        });
      } else {
        await chatRoomRef.update(chatRoomData);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message: ' + error.message);
      setNewMessage(messageText); 
    } finally {
      setLoading(false);
    }
  };

  const renderMessage = ({ item }) => {
    const isCurrentUser = currentUser && item.senderId === currentUser.uid;
    
    return (
      <View style={[
        styles.messageContainer,
        isCurrentUser ? styles.currentUserMessage : styles.otherUserMessage
      ]}>
        {!isCurrentUser && (
          <Text style={styles.senderName}>{item.senderName}</Text>
        )}
        <View style={[
          styles.messageBubble,
          isCurrentUser ? styles.currentUserBubble : styles.otherUserBubble
        ]}>
          <Text style={[
            styles.messageText,
            isCurrentUser ? styles.currentUserText : styles.otherUserText
          ]}>
            {item.text}
          </Text>
        </View>
        <Text style={styles.timestamp}>
          {item.timestamp && item.timestamp.seconds ? 
            new Date(item.timestamp.seconds * 1000).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            }) : 'Sending...'
          }
        </Text>
      </View>
    );
  };

  if (!currentUser) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!recipient || !recipient.uid) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Invalid chat recipient</Text>
          <TouchableOpacity 
            style={styles.backButtonAlt}
            onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
     

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          style={[styles.messagesList, { marginBottom: keyboardHeight }]}
          contentContainerStyle={styles.messagesContent}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>
                Start a conversation with {recipient.displayName}!
              </Text>
            </View>
          }
        />

        <View style={[styles.inputWrapper, { bottom: keyboardHeight }]}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Type a message..."
              multiline
              maxLength={500}
              returnKeyType="default"
              blurOnSubmit={false}
              onFocus={() => {
                setTimeout(() => {
                  flatListRef.current?.scrollToEnd({ animated: true });
                }, 300);
              }}
            />
            <TouchableOpacity
              style={[styles.sendButton, (!newMessage.trim() || loading) && styles.sendButtonDisabled]}
              onPress={sendMessage}
              disabled={!newMessage.trim() || loading}
            >
              <Text style={styles.sendButtonText}>
                {loading ? '...' : '➤'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  backButtonAlt: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  backButton: {
    fontSize: 24,
    marginRight: 16,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  headerAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerStatus: {
    fontSize: 12,
    color: '#666',
  },
  messagesList: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  messagesContent: {
    padding: 16,
    flexGrow: 1,
  },
  messageContainer: {
    marginVertical: 4,
    maxWidth: '80%',
  },
  currentUserMessage: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  otherUserMessage: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  senderName: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
    marginLeft: 12,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 18,
    marginBottom: 4,
  },
  currentUserBubble: {
    backgroundColor: '#007AFF',
  },
  otherUserBubble: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  messageText: {
    fontSize: 16,
  },
  currentUserText: {
    color: '#fff',
  },
  otherUserText: {
    color: '#000',
  },
  timestamp: {
    fontSize: 11,
    color: '#999',
    marginHorizontal: 8,
  },
  inputWrapper: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingBottom: Platform.OS === 'ios' ? 0 : 0,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    minHeight: 48,
    maxHeight: 120,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  sendButton: {
    backgroundColor: '#007AFF',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 100,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});

export default ChatScreen;
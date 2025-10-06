import { useEffect, useRef, useState } from 'react';

interface WebSocketMessage {
  type: 'analysis_update' | 'queue_update';
  analysis_id?: number;
  status?: string;
  progress?: number;
  error?: string;
  queue_position?: number;
  total_in_queue?: number;
  timestamp?: number;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  sendMessage: (message: string) => void;
  lastMessage: WebSocketMessage | null;
}

export const useWebSocket = (userId: number): UseWebSocketReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Connect to WebSocket with a small delay to ensure backend is ready
    const connect = () => {
      try {
        console.log(`Attempting to connect to WebSocket: ws://localhost:8000/ws/${userId}`);
        ws.current = new WebSocket(`ws://localhost:8000/ws/${userId}`);
        
        ws.current.onopen = () => {
          console.log('WebSocket connected');
          setIsConnected(true);
          // Send a test message
          ws.current?.send('test connection');
        };
        
        ws.current.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            setLastMessage(message);
            console.log('WebSocket message received:', message);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };
        
        ws.current.onclose = () => {
          console.log('WebSocket disconnected');
          setIsConnected(false);
          // Attempt to reconnect after 3 seconds
          setTimeout(connect, 3000);
        };
        
        ws.current.onerror = (error) => {
          console.error('WebSocket error:', error);
          console.error('WebSocket readyState:', ws.current?.readyState);
          console.error('WebSocket URL:', ws.current?.url);
          setIsConnected(false);
        };
      } catch (error) {
        console.error('Error creating WebSocket connection:', error);
        setIsConnected(false);
      }
    };

    // Add a small delay to ensure backend is ready
    const timeoutId = setTimeout(connect, 1000);

    // Cleanup on unmount
    return () => {
      clearTimeout(timeoutId);
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [userId]);

  const sendMessage = (message: string) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(message);
    } else {
      console.warn('WebSocket is not connected');
    }
  };

  return {
    isConnected,
    sendMessage,
    lastMessage
  };
};

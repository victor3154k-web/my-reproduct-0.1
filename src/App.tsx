import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mail, Lock, LogIn, Github, Chrome, Play, Music, 
  Heart, History, List, LogOut, User as UserIcon, 
  Search, Plus, Upload, ChevronRight, ChevronLeft, ArrowLeft, Settings,
  Volume2, Maximize, Pause, SkipForward, SkipBack, Cpu, RotateCw,
  Film, Tv, Monitor, Info, X, LayoutGrid, Star, Trash2, Zap
} from 'lucide-react';
import { auth, githubProvider, googleProvider, db } from './lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import Hls from 'hls.js';

type Tab = 'home' | 'favorites' | 'playlist' | 'history';
type Theme = 'ruby' | 'emerald';

interface VideoItem {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  type: 'hls' | 'mp4';
  duration?: string;
  category?: string;
  cast?: string;
  description?: string;
  year?: string;
}

export default function App() {
  const [theme, setTheme] = useState<'blue' | 'emerald'>('blue');
  const [mode, setMode] = useState<'amoled' | 'dark' | 'light'>('amoled');
  const [isHovered, setIsHovered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLowEndMode, setIsLowEndMode] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsView, setSettingsView] = useState<'main' | 'add'>('main');
  const [settingsTab, setSettingsTab] = useState<'geral' | 'aparencia' | 'biblioteca' | 'sobre' | 'admin'>('geral');
  const [selectedInfoVideo, setSelectedInfoVideo] = useState<VideoItem | null>(null);
  const [currentVideo, setCurrentVideo] = useState<VideoItem | null>(null);
  const [videoRotation, setVideoRotation] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);
  
  // State for user data
  const [history, setHistory] = useState<VideoItem[]>([]);
  const [favorites, setFavorites] = useState<VideoItem[]>([]);
  const [playlist, setPlaylist] = useState<VideoItem[]>([]);
  const [customVideos, setCustomVideos] = useState<VideoItem[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error' | 'offline'>('synced');
  const [showDefaultLibrary, setShowDefaultLibrary] = useState(true);

  // Form state for adding videos
  const [newVideoTitle, setNewVideoTitle] = useState('');
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [newVideoThumbnail, setNewVideoThumbnail] = useState('');
  const [newVideoThumbnailFile, setNewVideoThumbnailFile] = useState<File | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [newVideoCast, setNewVideoCast] = useState('');
  const [newVideoGenre, setNewVideoGenre] = useState('');
  const [newVideoDescription, setNewVideoDescription] = useState('');
  const [newVideoYear, setNewVideoYear] = useState('2026');

  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const previewHlsRef = useRef<Hls | null>(null);

  const defaultHeroVideos: VideoItem[] = [
    { 
      id: 'hero-1', 
      title: 'A JORNADA', 
      url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', 
      thumbnail: 'https://picsum.photos/seed/netflix-hero/1920/1080', 
      type: 'hls', 
      category: 'Sci-Fi',
      description: 'Em um futuro distópico, um grupo de sobreviventes descobre um sinal vindo de uma estação espacial abandonada que pode mudar o destino da humanidade.'
    },
    {
      id: 'hero-2',
      title: 'NEON NIGHTS',
      url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      thumbnail: 'https://picsum.photos/seed/neon/1920/1080',
      type: 'hls',
      category: 'Ação',
      description: 'As luzes da cidade escondem segredos que apenas os mais corajosos ousam enfrentar. Uma perseguição implacável começa agora.'
    },
    {
      id: 'hero-3',
      title: 'CYBERPUNK 2077',
      url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      thumbnail: 'https://picsum.photos/seed/cyber/1920/1080',
      type: 'hls',
      category: 'Cyberpunk',
      description: 'A tecnologia avançou, mas a humanidade ficou para trás. Explore as ruas perigosas de Night City.'
    }
  ];

  const heroVideos = useMemo(() => {
    const combined = [...favorites, ...history.slice(0, 5)];
    if (showDefaultLibrary) {
      combined.push(...defaultHeroVideos);
    }
    // Remove duplicates by ID
    return combined.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
  }, [favorites, history, showDefaultLibrary]);

  useEffect(() => {
    if (heroVideos.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentHeroIndex(prev => (prev + 1) % heroVideos.length);
    }, 8000); // Change every 8 seconds
    return () => clearInterval(interval);
  }, [heroVideos]);

  const currentHero = heroVideos[currentHeroIndex] || defaultHeroVideos[0];

  // Handle preview video in Info Modal
  useEffect(() => {
    if (selectedInfoVideo && previewVideoRef.current) {
      const video = previewVideoRef.current;
      
      if (selectedInfoVideo.type === 'hls' || selectedInfoVideo.url.includes('.m3u8')) {
        if (Hls.isSupported()) {
          if (previewHlsRef.current) {
            previewHlsRef.current.destroy();
          }
          const hls = new Hls();
          hls.loadSource(selectedInfoVideo.url);
          hls.attachMedia(video);
          previewHlsRef.current = hls;
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play().catch(e => console.log("Auto-play blocked:", e));
          });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = selectedInfoVideo.url;
          video.play().catch(e => console.log("Auto-play blocked:", e));
        }
      } else {
        video.src = selectedInfoVideo.url;
        video.play().catch(e => console.log("Auto-play blocked:", e));
      }
    }

    return () => {
      if (previewHlsRef.current) {
        previewHlsRef.current.destroy();
        previewHlsRef.current = null;
      }
    };
  }, [selectedInfoVideo]);

  // Automatic theme cycling
  useEffect(() => {
    const interval = setInterval(() => {
      setTheme(prev => prev === 'blue' ? 'emerald' : 'blue');
    }, 5000); // Change every 5 seconds
    return () => clearInterval(interval);
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    if (!auth) return;

    // Handle redirect result for mobile/webview environments
    getRedirectResult(auth).then((result) => {
      if (result?.user) {
        console.log("Login via redirect bem-sucedido:", result.user.email);
      }
    }).catch((error) => {
      console.error("Erro ao processar redirecionamento de login:", error);
      if (error.code === 'auth/internal-error' || error.code === 'auth/network-request-failed') {
        alert('Erro de conexão ao tentar login. Verifique sua internet.');
      }
    });

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsInitializing(false);
      if (currentUser) {
        // Check if user is admin
        const adminEmail = "victor3154k@gmail.com";
        if (currentUser.email === adminEmail) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } else {
        // Clear local state on logout
        setIsAdmin(false);
        setHistory([]);
        setFavorites([]);
        setPlaylist([]);
        setCustomVideos([]);
        setIsDataLoaded(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Load user data from Firestore
  useEffect(() => {
    if (!user || !db) {
      if (!db) setSyncStatus('offline');
      return;
    }

    const userDocRef = doc(db, 'users', user.uid);
    
    const loadData = async () => {
      setSyncStatus('syncing');
      try {
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.history) setHistory(data.history);
          if (data.favorites) setFavorites(data.favorites);
          if (data.playlist) setPlaylist(data.playlist);
          if (data.customVideos) setCustomVideos(data.customVideos);
          if (data.showDefaultLibrary !== undefined) setShowDefaultLibrary(data.showDefaultLibrary);
          console.log("Dados carregados da nuvem com sucesso.");
        } else {
          console.log("Nenhum dado prévio encontrado na nuvem. Criando perfil de usuário.");
          // Create initial user profile
          await setDoc(userDocRef, {
            uid: user.uid,
            email: user.email || '',
            role: user.email === "victor3154k@gmail.com" ? 'admin' : 'user',
            createdAt: new Date().toISOString(),
            history: [],
            favorites: [],
            playlist: [],
            customVideos: [],
            showDefaultLibrary: true
          });
        }
        setIsDataLoaded(true);
        setSyncStatus('synced');
      } catch (error: any) {
        console.error("Erro ao carregar dados do Firestore:", error);
        // Se o erro for de permissão ou banco não encontrado, ainda permitimos o uso local
        // mas marcamos como erro de sincronização
        setSyncStatus('error');
        // Importante: Não definimos isDataLoaded como true se for erro de conexão 
        // para evitar sobrescrever dados da nuvem com dados vazios locais
        if (error.code === 'permission-denied' || error.code === 'not-found') {
          setIsDataLoaded(true);
        }
      }
    };

    loadData();
  }, [user]);

  // Save user data to Firestore whenever it changes
  useEffect(() => {
    if (!user || !db || !isDataLoaded) return;

    const saveData = async () => {
      setSyncStatus('syncing');
      try {
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, {
          history,
          favorites,
          playlist,
          customVideos,
          showDefaultLibrary,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        setSyncStatus('synced');
        console.log("Sincronização concluída.");
      } catch (error: any) {
        console.error("Erro ao salvar no Firestore:", error);
        setSyncStatus('error');
      }
    };

    const timeoutId = setTimeout(saveData, 2000); // Aumentado para 2s para evitar excesso de escritas
    return () => clearTimeout(timeoutId);
  }, [history, favorites, playlist, customVideos, showDefaultLibrary, user, isDataLoaded]);

  // Video Player Logic
  useEffect(() => {
    if (currentVideo && videoRef.current) {
      const video = videoRef.current;
      
      if (currentVideo.type === 'hls') {
        if (Hls.isSupported()) {
          if (hlsRef.current) hlsRef.current.destroy();
          const hls = new Hls();
          hls.loadSource(currentVideo.url);
          hls.attachMedia(video);
          hlsRef.current = hls;
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = currentVideo.url;
        }
      } else {
        if (hlsRef.current) hlsRef.current.destroy();
        video.src = currentVideo.url;
      }
      
      video.play().catch(e => console.log("Auto-play blocked", e));
      
      // Add to history
      setHistory(prev => {
        const filtered = prev.filter(v => v.id !== currentVideo.id);
        return [currentVideo, ...filtered].slice(0, 12);
      });
    }
  }, [currentVideo]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) {
      alert('Firebase não está configurado. Adicione as chaves de API nas configurações.');
      return;
    }
    setIsLoading(true);
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      alert('Erro: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!auth) {
      alert('Firebase não está configurado. Adicione as chaves de API nas configurações.');
      return;
    }
    setIsLoading(true);
    try {
      const isWebView = /wv|Median|GoNative/i.test(navigator.userAgent) || 
                        (window.innerWidth <= 768 && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
      
      if (isWebView) {
        await signInWithRedirect(auth, googleProvider);
      } else {
        try {
          await signInWithPopup(auth, googleProvider);
        } catch (popupError: any) {
          if (popupError.code === 'auth/popup-blocked' || popupError.code === 'auth/cancelled-popup-request') {
            await signInWithRedirect(auth, googleProvider);
          } else {
            throw popupError;
          }
        }
      }
    } catch (error: any) {
      console.error("Erro no Google Login:", error);
      if (error.code !== 'auth/cancelled-popup-request') {
        alert('Erro no Google Login: ' + error.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGithubLogin = async () => {
    if (!auth) {
      alert('Firebase não está configurado. Adicione as chaves de API nas configurações.');
      return;
    }
    setIsLoading(true);
    try {
      const isWebView = /wv|Median|GoNative/i.test(navigator.userAgent) || 
                        (window.innerWidth <= 768 && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
      
      if (isWebView) {
        await signInWithRedirect(auth, githubProvider);
      } else {
        try {
          await signInWithPopup(auth, githubProvider);
        } catch (popupError: any) {
          if (popupError.code === 'auth/popup-blocked' || popupError.code === 'auth/cancelled-popup-request') {
            await signInWithRedirect(auth, githubProvider);
          } else {
            throw popupError;
          }
        }
      }
    } catch (error: any) {
      console.error("Erro no GitHub Login:", error);
      if (error.code !== 'auth/cancelled-popup-request') {
        alert('Erro no GitHub Login: ' + error.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    if (auth) auth.signOut();
    setShowProfileMenu(false);
    setCurrentVideo(null);
  };

  const handleRemoveFromList = (video: VideoItem, listId: string) => {
    if (listId === 'favorites') {
      setFavorites(prev => prev.filter(v => v.id !== video.id));
    } else if (listId === 'playlist') {
      setPlaylist(prev => prev.filter(v => v.id !== video.id));
    } else if (listId === 'history') {
      setHistory(prev => prev.filter(v => v.id !== video.id));
    } else if (listId === 'home') {
      // Only allow removing custom videos from the home row
      setCustomVideos(prev => prev.filter(v => v.id !== video.id));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const isHls = file.name.endsWith('.m3u8');
      const newVideo: VideoItem = {
        id: Math.random().toString(36).substr(2, 9),
        title: file.name,
        url: url,
        thumbnail: `https://picsum.photos/seed/${file.name}/400/225`,
        type: isHls ? 'hls' : 'mp4',
        category: 'Local'
      };
      setCurrentVideo(newVideo);
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;
    
    const isHls = searchQuery.includes('.m3u8');
    const newVideo: VideoItem = {
      id: Math.random().toString(36).substr(2, 9),
      title: searchQuery.split('/').pop()?.split('?')[0] || 'Stream Online',
      url: searchQuery,
      thumbnail: `https://picsum.photos/seed/${Math.random()}/400/225`,
      type: isHls ? 'hls' : 'mp4',
      category: 'Web'
    };
    setCurrentVideo(newVideo);
    setSearchQuery('');
  };

  const toggleFavorite = (video: VideoItem) => {
    setFavorites(prev => {
      const exists = prev.find(v => v.id === video.id);
      if (exists) return prev.filter(v => v.id !== video.id);
      return [...prev, video];
    });
  };

  const togglePlaylist = (video: VideoItem) => {
    setPlaylist(prev => {
      const exists = prev.find(v => v.id === video.id);
      if (exists) return prev.filter(v => v.id !== video.id);
      return [...prev, video];
    });
  };

  const themeConfig = {
    blue: {
      accent: 'bg-[#0066FF]', // LED Blue
      glow: 'shadow-[0_0_25px_rgba(0,102,255,0.4)]',
      border: 'border-[#0066FF]/30',
      icon: <Monitor className="w-5 h-5" />,
      name: 'Blue LED',
      secondary: 'text-[#0066FF]'
    },
    emerald: {
      accent: 'bg-[#00FF66]', // LED Green
      glow: 'shadow-[0_0_25px_rgba(0,255,102,0.4)]',
      border: 'border-[#00FF66]/30',
      icon: <Play className="w-5 h-5 fill-current" />,
      name: 'Green LED',
      secondary: 'text-[#00FF66]'
    }
  };

  const current = themeConfig[theme];

  const modeConfig = {
    amoled: {
      bg: 'bg-black',
      card: 'bg-zinc-900/50 border-zinc-800/50',
      text: 'text-white',
      secondary: 'text-zinc-400',
      accent: 'bg-white text-black',
      button: 'bg-zinc-800/50 hover:bg-zinc-700/50 border-zinc-700/50',
      glass: 'backdrop-blur-xl bg-black/40 border-zinc-800/50',
      border: 'border-zinc-800/50',
      muted: 'text-zinc-500',
      input: 'bg-zinc-900/50 border-zinc-800/50',
      header: 'from-black'
    },
    dark: {
      bg: 'bg-zinc-950',
      card: 'bg-zinc-900/40 border-zinc-800/40',
      text: 'text-zinc-100',
      secondary: 'text-zinc-400',
      accent: 'bg-indigo-600 text-white',
      button: 'bg-zinc-800/40 hover:bg-zinc-700/40 border-zinc-700/40',
      glass: 'backdrop-blur-xl bg-zinc-900/40 border-zinc-800/40',
      border: 'border-zinc-800/40',
      muted: 'text-zinc-500',
      input: 'bg-zinc-900/40 border-zinc-800/40',
      header: 'from-black'
    },
    light: {
      bg: 'bg-zinc-50',
      card: 'bg-white/60 border-zinc-200/60',
      text: 'text-zinc-900',
      secondary: 'text-zinc-500',
      accent: 'bg-indigo-600 text-white',
      button: 'bg-zinc-100/60 hover:bg-zinc-200/60 border-zinc-200/60',
      glass: 'backdrop-blur-xl bg-white/60 border-zinc-200/60',
      border: 'border-zinc-200/60',
      muted: 'text-zinc-400',
      input: 'bg-white/60 border-zinc-200/60',
      header: 'from-black'
    }
  };

  const m = modeConfig[mode];

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-white/10 border-t-white rounded-full"
        />
      </div>
    );
  }

  // Login Screen (Original Theme)
  if (!user) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-6 bg-[#050505] relative overflow-hidden"
      >
        {/* Low-End Mode Toggle Button */}
        <div className="absolute top-6 left-6 z-50">
          <button
            onClick={() => setIsLowEndMode(!isLowEndMode)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all text-[10px] font-black uppercase tracking-widest ${
              isLowEndMode 
                ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.3)]' 
                : 'bg-black/40 text-white border-white/20 hover:border-white/40'
            }`}
          >
            <Cpu className="w-3 h-3" />
            {isLowEndMode ? 'Modo Econômico (GPU)' : 'Modo Visual (LED)'}
          </button>
        </div>

        {/* LED Background Grid */}
        <div className="absolute inset-0 z-0 opacity-10 bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:32px_32px]" />

        {/* Animated Background LED Glows */}
        {!isLowEndMode && (
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
            <motion.div 
              animate={{ 
                opacity: [0.05, 0.2, 0.05],
                scale: [1, 1.2, 1],
              }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              className={`absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full blur-[120px] ${theme === 'blue' ? 'bg-[#0066FF]' : 'bg-[#00FF66]'} will-change-[opacity,transform]`}
            />
            <motion.div 
              animate={{ 
                opacity: [0.05, 0.15, 0.05],
                scale: [1, 1.3, 1],
              }}
              transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              className={`absolute bottom-1/4 right-1/4 w-[600px] h-[600px] rounded-full blur-[120px] ${theme === 'blue' ? 'bg-[#00FF66]' : 'bg-[#0066FF]'} will-change-[opacity,transform]`}
            />
          </div>
        )}

        <motion.div
          initial={isLowEndMode ? { opacity: 1, y: 0 } : { opacity: 0, scale: 0.9, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={isLowEndMode ? { duration: 0 } : { duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
          className="w-full max-w-md relative z-10"
        >
          {/* Login Card with LED Effect */}
          <div 
            className={`relative p-[2px] rounded-3xl overflow-hidden group ${isLowEndMode ? 'bg-white/10' : 'bg-transparent'}`}
          >
            {!isLowEndMode && (
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                className="absolute inset-[-100%] z-0 will-change-transform"
                style={{
                  background: `conic-gradient(from 0deg, transparent, ${theme === 'blue' ? '#0066FF' : '#00FF66'}, transparent 40%)`
                }}
              />
            )}
            
            <div className={`relative z-10 bg-[#0a0a0a] ${!isLowEndMode ? 'backdrop-blur-2xl bg-[#0a0a0a]/90' : ''} rounded-[22px] p-5 md:p-10 shadow-2xl border border-white/5`}>
              <div className="text-center mb-5 md:mb-10">
                <motion.div
                  initial={isLowEndMode ? { opacity: 1, y: 0 } : { y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={isLowEndMode ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 20 }}
                  className={`inline-flex items-center justify-center w-10 h-10 md:w-16 md:h-16 rounded-2xl ${current.accent} text-white mb-3 md:mb-6 relative z-10 ${current.glow} ${!isLowEndMode ? 'shadow-[0_0_30px_rgba(0,0,0,0.5)]' : ''}`}
                >
                  {current.icon}
                </motion.div>
                
                <motion.h1 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-xl md:text-3xl font-display font-black tracking-tighter mb-1 md:mb-2"
                >
                  LUMINA <span className={current.secondary}>ACESSO</span>
                </motion.h1>
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-zinc-500 text-[7px] md:text-[10px] font-bold uppercase tracking-[0.3em]"
                >
                  {isSignUp ? 'Crie sua identidade digital' : 'Autentique-se para continuar'}
                </motion.p>
              </div>

              <form className="space-y-3 md:space-y-6 relative z-10" onSubmit={handleLogin}>
                <div className="space-y-1 md:space-y-2">
                  <label className="text-[7px] md:text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-1">Identidade</label>
                  <div className="relative group/input">
                    <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 w-3 h-3 md:w-4 md:h-4 transition-colors ${theme === 'blue' ? 'group-focus-within/input:text-[#0066FF]' : 'group-focus-within/input:text-[#00FF66]'} text-zinc-600`} />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@lumina.com"
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 md:py-4 pl-10 md:pl-12 pr-4 text-[10px] md:text-sm focus:outline-none focus:border-white/20 focus:bg-white/10 transition-all placeholder:text-zinc-800 font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-1 md:space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[7px] md:text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Segredo</label>
                    {!isSignUp && <button type="button" className="text-[7px] md:text-[10px] text-zinc-600 hover:text-white transition-colors font-bold">Recuperar</button>}
                  </div>
                  <div className="relative group/input">
                    <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 w-3 h-3 md:w-4 md:h-4 transition-colors ${theme === 'blue' ? 'group-focus-within/input:text-[#0066FF]' : 'group-focus-within/input:text-[#00FF66]'} text-zinc-600`} />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 md:py-4 pl-10 md:pl-12 pr-4 text-[10px] md:text-sm focus:outline-none focus:border-white/20 focus:bg-white/10 transition-all placeholder:text-zinc-800 font-medium"
                    />
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  type="submit"
                  disabled={isLoading}
                  className={`w-full py-2.5 md:py-4 rounded-xl font-black text-[9px] md:text-xs tracking-[0.2em] transition-all disabled:opacity-50 bg-zinc-100 hover:bg-white text-black relative overflow-hidden group/btn`}
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {isLoading ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-3 h-3 md:w-4 md:h-4 border-2 border-black/30 border-t-black rounded-full"
                      />
                    ) : (
                      <>
                        {isSignUp ? 'REGISTRAR CONTA' : 'ENTRAR NO SISTEMA'} <LogIn className="w-3 h-3 md:w-4 md:h-4" />
                      </>
                    )}
                  </span>
                  <motion.div 
                    className="absolute inset-0 bg-black/5 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-1000"
                  />
                </motion.button>
              </form>

              <div className="mt-6 md:mt-10 relative z-10">
                <div className="relative flex items-center justify-center mb-5 md:mb-8">
                  <div className="absolute w-full h-px bg-white/5" />
                  <span className="relative px-4 bg-[#0d0d0d] text-[7px] md:text-[10px] font-black text-zinc-600 uppercase tracking-[0.4em]">Protocolo Externo</span>
                </div>

                <div className="grid grid-cols-2 gap-2 md:gap-4">
                  <motion.button 
                    whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.2)' }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                    className="flex items-center justify-center gap-2 md:gap-3 py-2.5 md:py-4 rounded-xl bg-white/5 border border-white/10 text-[7px] md:text-[10px] font-black tracking-[0.2em] transition-all"
                  >
                    <Chrome className="w-3 h-3 md:w-4 md:h-4" /> GOOGLE
                  </motion.button>
                  <motion.button 
                    whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.2)' }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleGithubLogin}
                    disabled={isLoading}
                    className="flex items-center justify-center gap-2 md:gap-3 py-2.5 md:py-4 rounded-xl bg-white/5 border border-white/10 text-[7px] md:text-[10px] font-black tracking-[0.2em] transition-all"
                  >
                    <Github className="w-3 h-3 md:w-4 md:h-4" /> GITHUB
                  </motion.button>
                </div>

                <div className="mt-6 md:mt-10 text-center">
                  <button 
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="text-[7px] md:text-[10px] font-black text-zinc-500 hover:text-white transition-colors uppercase tracking-[0.2em]"
                  >
                    {isSignUp ? 'Já possui uma conta? Entrar' : "Não tem uma conta? Criar agora"}
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="text-center mt-10 text-[10px] text-zinc-800 font-black uppercase tracking-[0.5em]"
          >
            Lumina LED Protocol v5.0
          </motion.p>
        </motion.div>
      </div>
    );
  }

  // Dashboard Screen (Netflix Style)
  return (
    <div className={`min-h-screen ${m.bg} ${m.text} font-sans flex flex-col selection:bg-[#E50914]/30 overflow-x-hidden transition-colors duration-500`}>
      {/* Header - Floating Glassmorphism */}
      <header 
        className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-500 ${
          isHovered ? `py-1 md:py-4 px-2 md:px-8` : `py-1.5 md:py-6 px-3 md:px-12`
        }`}
      >
        <div className={`max-w-7xl mx-auto flex items-center justify-between px-2.5 md:px-6 py-1 md:py-3 rounded-xl md:rounded-2xl border ${m.border} backdrop-blur-xl bg-black/20 shadow-2xl transition-all duration-500 ${isHovered ? 'scale-[1.01] md:scale-[1.02]' : 'scale-100'}`}>
          <div className="flex items-center gap-2 md:gap-10">
            <h1 
              onClick={() => setActiveTab('home')}
              className="text-base md:text-2xl font-display font-black tracking-tighter cursor-pointer group flex items-center gap-1.5 md:gap-2"
            >
              <div className="w-5 h-5 md:w-8 md:h-8 bg-white rounded-lg flex items-center justify-center group-hover:rotate-12 transition-transform">
                <Monitor className="w-3 h-3 md:w-5 md:h-5 text-black" />
              </div>
              <span className="hidden sm:block text-white">LUMINA</span>
            </h1>
            
            <nav className="hidden lg:flex items-center gap-8">
              {[
                { id: 'home', label: 'Início' },
                { id: 'favorites', label: 'Minha Lista' },
                { id: 'playlist', label: 'Playlist' },
                { id: 'history', label: 'Vistos' }
              ].map((item) => (
                <button 
                  key={item.id}
                  onClick={() => setActiveTab(item.id as Tab)}
                  className={`text-xs font-black uppercase tracking-widest transition-all relative py-2 ${
                    activeTab === item.id ? m.text : `${m.muted} hover:${m.text}`
                  }`}
                >
                  {item.label}
                  {activeTab === item.id && (
                    <motion.div 
                      layoutId="activeTab"
                      className="absolute -bottom-1 left-0 right-0 h-0.5 bg-white rounded-full"
                    />
                  )}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-4 md:gap-6">
            <div className={`relative hidden md:flex items-center group/search`}>
              <Search className={`absolute left-3 w-4 h-4 ${m.muted} group-focus-within/search:text-white transition-colors`} />
              <form onSubmit={handleUrlSubmit}>
                <input 
                  type="text" 
                  placeholder="Buscar..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-32 lg:w-64 pl-9 pr-3 py-1.5 text-[10px] md:text-xs rounded-full border ${m.border} ${m.input} focus:w-48 lg:focus:w-80 transition-all outline-none font-medium`}
                />
              </form>
            </div>

            <div className="relative">
              <button 
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden border-2 border-white/10 hover:border-white/40 transition-all active:scale-90"
              >
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="Profile" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-zinc-700 flex items-center justify-center text-xs font-bold">
                    {user?.email ? user.email.charAt(0).toUpperCase() : <UserIcon className="w-4 h-4" />}
                  </div>
                )}
              </button>

              <AnimatePresence>
                {showProfileMenu && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className={`absolute right-0 mt-3 w-48 md:w-64 ${m.card} border ${m.border} shadow-2xl rounded-xl md:rounded-2xl py-2 md:py-3 z-50 backdrop-blur-2xl`}
                  >
                    <div className={`px-4 md:px-5 py-2 md:py-3 border-b ${m.border} mb-1 md:mb-2`}>
                      <p className="text-[10px] md:text-xs font-black tracking-tight truncate">{user?.displayName || 'Visitante'}</p>
                      <p className={`text-[8px] md:text-[10px] ${m.muted} truncate font-medium`}>{user?.email || 'Modo Offline'}</p>
                    </div>
                    <button className={`w-full text-left px-4 md:px-5 py-2 md:py-2.5 text-[10px] md:text-xs font-bold hover:${m.input} transition-colors`}>Sua Conta</button>
                    <button 
                      onClick={() => { setShowSettings(true); setShowProfileMenu(false); }}
                      className={`w-full text-left px-4 md:px-5 py-2 md:py-2.5 text-[10px] md:text-xs font-bold hover:${m.input} transition-colors flex items-center justify-between`}
                    >
                      Configurações <Settings className="w-2.5 h-2.5 md:w-3 md:h-3 opacity-50" />
                    </button>
                    <div className={`h-px ${m.border} my-1.5 md:my-2 mx-4 md:mx-5`} />
                    {user ? (
                      <button 
                        onClick={handleLogout}
                        className={`w-full text-left px-4 md:px-5 py-2 md:py-2.5 text-[10px] md:text-xs font-black uppercase tracking-widest hover:${m.input} text-red-500 transition-colors`}
                      >
                        Sair da Lumina
                      </button>
                    ) : (
                      <button 
                        onClick={() => window.location.reload()}
                        className={`w-full text-left px-4 md:px-5 py-2 md:py-2.5 text-[10px] md:text-xs font-black uppercase tracking-widest hover:${m.input} text-green-500 transition-colors`}
                      >
                        Entrar no Sistema
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {/* Billboard / Hero Section */}
        <section className="relative h-[56.25vw] md:h-[80vh] w-full overflow-hidden">
          {currentVideo ? (
              <div className="absolute inset-0 bg-black z-50 flex items-center justify-center overflow-hidden group/player">
                <video 
                  ref={videoRef}
                  className="w-full h-full object-contain transition-transform duration-300"
                  style={{ 
                    transform: `rotate(${videoRotation}deg)`,
                    width: (videoRotation % 180 !== 0) ? '100vh' : '100%',
                    height: (videoRotation % 180 !== 0) ? '100vw' : '100%',
                  }}
                  controls
                  autoPlay
                />
                
                {/* Custom Overlay Controls (Don't rotate) */}
                <div className="absolute top-0 left-0 right-0 p-4 md:p-10 flex items-center justify-between z-20 bg-gradient-to-b from-black/80 to-transparent opacity-100 transition-opacity duration-300">
                  <div className="flex items-center gap-2 md:gap-3">
                    <button 
                      onClick={() => { setCurrentVideo(null); setVideoRotation(0); }}
                      className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-white/10 hover:bg-white/20 rounded-md transition-colors text-white font-bold backdrop-blur-md border border-white/10 text-[10px] md:text-sm"
                    >
                      <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" /> Voltar
                    </button>
                    <div className="h-5 md:h-6 w-px bg-white/20 mx-0.5 md:mx-1" />
                    <h3 className="text-white font-bold hidden md:block truncate max-w-[200px]">{currentVideo.title}</h3>
                  </div>

                  <div className="flex items-center gap-2 md:gap-3">
                    <button 
                      onClick={() => setVideoRotation(prev => (prev + 90) % 360)}
                      className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-white/10 hover:bg-white/20 rounded-md transition-colors text-white font-bold backdrop-blur-md border border-white/10 text-[10px] md:text-sm"
                      title="Rotacionar Vídeo"
                    >
                      <RotateCw className="w-4 h-4 md:w-5 md:h-5" />
                      <span className="hidden sm:inline">Rotacionar</span>
                    </button>
                    
                    <button 
                      onClick={() => {
                        const container = videoRef.current?.parentElement;
                        if (container) {
                          if (document.fullscreenElement) {
                            document.exitFullscreen();
                          } else {
                            container.requestFullscreen().catch(err => {
                              console.error(`Error attempting to enable full-screen mode: ${err.message}`);
                            });
                          }
                        }
                      }}
                      className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-white/10 hover:bg-white/20 rounded-md transition-colors text-white font-bold backdrop-blur-md border border-white/10 text-[10px] md:text-sm"
                      title="Tela Cheia"
                    >
                      <Maximize className="w-4 h-4 md:w-5 md:h-5" />
                      <span className="hidden sm:inline">Tela Cheia</span>
                    </button>
                  </div>
                </div>
              </div>
          ) : (
            <>
              <AnimatePresence mode="wait">
                <motion.div 
                  key={currentHero.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1 }}
                  className="absolute inset-0"
                >
                  <img 
                    src={currentHero.thumbnail || 'https://picsum.photos/seed/netflix-hero/1920/1080'} 
                    className="w-full h-full object-cover" 
                    alt={currentHero.title}
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black via-black/40 to-transparent" />
                  <div className={`absolute inset-0 bg-gradient-to-t ${m.header.replace('from-black', 'from-' + (mode === 'light' ? 'white' : 'black'))} via-transparent to-transparent`} />
                </motion.div>
              </AnimatePresence>

              <div className="absolute bottom-[12%] md:bottom-[20%] left-3 md:left-20 max-w-4xl space-y-2 md:space-y-10 z-10 pr-4">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentHero.id}
                    initial={{ opacity: 0, x: -40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 40 }}
                    transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
                    className="space-y-2 md:space-y-8"
                  >
                    <div className="space-y-1 md:space-y-4">
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-1.5 md:gap-3"
                      >
                        <div className="bg-red-600 p-0.5 md:p-1 rounded-sm shadow-lg shadow-red-600/20">
                          <Play className="w-1.5 md:w-2.5 h-1.5 md:h-2.5 fill-current text-white" />
                        </div>
                        <span className={`text-[6px] md:text-[10px] font-black tracking-[0.3em] uppercase ${m.muted}`}>
                          {currentHero.category || 'Original Lumina'}
                        </span>
                      </motion.div>
                      
                      <h2 className={`text-2xl md:text-9xl font-display font-black tracking-tighter leading-[0.9] md:leading-[0.8] uppercase ${m.text}`}>
                        {currentHero.title}
                      </h2>
                    </div>
                    
                    <p className={`text-[9px] md:text-xl ${m.text} font-medium max-w-2xl line-clamp-2 md:line-clamp-none drop-shadow-2xl opacity-90 leading-relaxed`}>
                      {currentHero.description || 'Uma história épica de coragem e descoberta em um universo em constante expansão.'}
                    </p>

                    <div className="flex items-center gap-1.5 md:gap-4 pt-2 md:pt-4">
                      <button 
                        onClick={() => setCurrentVideo(currentHero)}
                        className="flex items-center gap-1.5 md:gap-3 px-3 md:px-10 py-2 md:py-4 bg-white text-black rounded-full font-black uppercase tracking-widest text-[7px] md:text-xs hover:scale-105 transition-all shadow-2xl active:scale-95"
                      >
                        <Play className="w-3 h-3 md:w-5 md:h-5 fill-current" /> Assistir
                      </button>
                      <button 
                        onClick={() => setSelectedInfoVideo(currentHero)}
                        className={`flex items-center gap-1.5 md:gap-3 px-3 md:px-8 py-2 md:py-4 ${m.input} ${m.text} rounded-full font-black uppercase tracking-widest text-[7px] md:text-xs hover:bg-white/20 transition-all backdrop-blur-md border ${m.border} active:scale-95`}
                      >
                        <Info className="w-3 h-3 md:w-5 md:h-5" /> Detalhes
                      </button>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </>
          )}
        </section>

        <div className="relative z-10 -mt-6 md:-mt-48 pb-16 md:pb-32 space-y-8 md:space-y-24">
          {activeTab !== 'home' && (
            <div className="max-w-7xl mx-auto px-3 md:px-12 pt-3">
              <button 
                onClick={() => setActiveTab('home')}
                className={`flex items-center gap-1.5 ${m.muted} hover:${m.text} transition-colors text-[9px] font-black uppercase tracking-widest`}
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Voltar
              </button>
            </div>
          )}
          
          {[
            { id: 'home', title: 'Populares na Lumina', data: [
              ...customVideos,
              ...(showDefaultLibrary ? [
                { id: '1', title: 'Big Buck Bunny', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', thumbnail: 'https://picsum.photos/seed/bunny/600/338', type: 'hls' as const },
                { id: '2', title: 'Elephants Dream', url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', thumbnail: 'https://picsum.photos/seed/elephant/600/338', type: 'mp4' as const },
                { id: '3', title: 'Sintel', url: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8', thumbnail: 'https://picsum.photos/seed/sintel/600/338', type: 'hls' as const },
                { id: '4', title: 'Tears of Steel', url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4', thumbnail: 'https://picsum.photos/seed/steel/600/338', type: 'mp4' as const },
                { id: '5', title: 'For Bigger Blazes', url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', thumbnail: 'https://picsum.photos/seed/fire/600/338', type: 'mp4' as const },
                { id: '6', title: 'For Bigger Escapes', url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', thumbnail: 'https://picsum.photos/seed/escape/600/338', type: 'mp4' as const }
              ] : [])
            ]},
            { id: 'favorites', title: 'Minha Lista', data: favorites },
            { id: 'playlist', title: 'Playlist de Reprodução', data: playlist },
            { id: 'history', title: 'Continuar Assistindo', data: history }
          ].filter(row => activeTab === 'home' || row.id === activeTab).map((row, idx) => (
            <motion.div 
              key={idx} 
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, delay: idx * 0.1, ease: [0.23, 1, 0.32, 1] }}
              className="max-w-7xl mx-auto px-3 md:px-12 space-y-4 md:space-y-8"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base md:text-3xl font-display font-black tracking-tighter text-white hover:text-white/80 cursor-pointer inline-flex items-center gap-2 md:gap-3 group">
                  {row.title} 
                  <ChevronRight className="w-4 h-4 md:w-6 md:h-6 opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500" />
                </h3>
              </div>
              
              <div className="relative group/row">
                <div className="flex gap-2 md:gap-6 overflow-x-auto scrollbar-hide pb-4 md:pb-8 snap-x">
                  {row.data.length > 0 ? row.data.map((video) => (
                    <motion.div 
                      key={video.id}
                      layout
                      whileHover={{ 
                        scale: 1.05, 
                        zIndex: 20,
                        transition: { type: 'spring', stiffness: 400, damping: 25 }
                      }}
                      whileTap={{ scale: 0.96 }}
                      className="flex-none w-[40vw] sm:w-[35vw] md:w-[22vw] aspect-video relative rounded-lg md:rounded-2xl overflow-hidden cursor-pointer snap-start shadow-2xl group/card"
                      onClick={() => setSelectedInfoVideo(video)}
                    >
                      <img 
                        src={video.thumbnail} 
                        alt={video.title} 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover/card:scale-110"
                        referrerPolicy="no-referrer"
                      />
                      
                      {/* Card Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover/card:opacity-100 transition-all duration-500 flex flex-col justify-end p-2 md:p-6">
                        <div className="flex items-center justify-between mb-1.5 md:mb-4">
                          <div className="flex items-center gap-1.5 md:gap-3">
                            <button 
                              onClick={(e) => { e.stopPropagation(); setCurrentVideo(video); }}
                              className="w-7 h-7 md:w-10 md:h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 transition-transform shadow-xl"
                            >
                              <Play className="w-3 h-3 md:w-5 md:h-5 fill-current ml-0.5 md:ml-1" />
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); toggleFavorite(video); }}
                              className={`w-7 h-7 md:w-10 md:h-10 rounded-full border border-white/40 flex items-center justify-center hover:bg-white hover:text-black transition-all ${favorites.find(f => f.id === video.id) ? 'bg-white text-black' : 'bg-black/40 backdrop-blur-md'}`}
                            >
                              <Plus className="w-3 h-3 md:w-5 md:h-5" />
                            </button>
                          </div>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setSelectedInfoVideo(video); }}
                            className="w-7 h-7 md:w-10 md:h-10 rounded-full border border-white/40 flex items-center justify-center hover:bg-white/20 transition-all bg-black/40 backdrop-blur-md"
                          >
                            <Info className="w-3 h-3 md:w-5 md:h-5" />
                          </button>
                        </div>
                        
                        <div className="space-y-0.5 md:space-y-1">
                          <p className="text-[9px] md:text-sm font-black tracking-tight text-white line-clamp-1">{video.title}</p>
                          <div className="flex items-center gap-1 md:gap-2 text-[7px] md:text-[10px] font-bold text-zinc-400">
                            <span className="text-green-500">98% Match</span>
                            <span>{video.year || '2026'}</span>
                            <span className="border border-white/20 px-0.5 md:px-1 rounded-sm">HD</span>
                          </div>
                        </div>

                        {/* Remove button for custom videos */}
                        {(row.id !== 'home' || customVideos.some(cv => cv.id === video.id)) && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleRemoveFromList(video, row.id); }}
                            className="absolute top-1.5 md:top-4 right-1.5 md:right-4 w-5 h-5 md:w-8 md:h-8 rounded-full bg-red-600/80 text-white flex items-center justify-center shadow-xl hover:bg-red-600 transition-colors z-30 backdrop-blur-md"
                            title="Remover"
                          >
                            <Trash2 className="w-2.5 h-2.5 md:w-4 md:h-4" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )) : (
                    <div className="w-full py-12 md:py-16 text-center border-2 border-dashed border-white/5 rounded-2xl md:rounded-3xl">
                      <p className={`text-xs md:text-sm font-bold ${m.muted} italic`}>
                        Nenhum título adicionado nesta categoria.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className={`py-20 px-6 md:px-12 ${m.bg} border-t ${m.border} ${m.muted} text-[10px] font-black uppercase tracking-[0.2em]`}>
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="flex gap-8">
            <Github className="w-6 h-6 cursor-pointer hover:text-white transition-colors" />
            <Monitor className="w-6 h-6 cursor-pointer hover:text-white transition-colors" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <span className="hover:text-white cursor-pointer transition-colors">Audiodescrição</span>
            <span className="hover:text-white cursor-pointer transition-colors">Relações com investidores</span>
            <span className="hover:text-white cursor-pointer transition-colors">Privacidade</span>
            <span className="hover:text-white cursor-pointer transition-colors">Entre em contato</span>
          </div>
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-8 border-t border-white/5">
            <p>© 2026 Lumina Streaming, Inc.</p>
            <div className="flex gap-6">
              <span className="hover:text-white cursor-pointer transition-colors">Termos de Uso</span>
              <span className="hover:text-white cursor-pointer transition-colors">Cookies</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Info Modal (Netflix Style) */}
      <AnimatePresence>
        {selectedInfoVideo && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-0 md:p-10 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedInfoVideo(null)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 50 }}
              className={`relative w-full md:max-w-4xl min-h-screen md:min-h-0 ${m.card} md:rounded-xl shadow-2xl overflow-hidden`}
            >
              {/* Modal Header Image */}
              <div className="relative aspect-video w-full">
                <img 
                  src={selectedInfoVideo.thumbnail || 'https://picsum.photos/seed/info/1280/720'} 
                  alt={selectedInfoVideo.title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <video 
                  ref={previewVideoRef}
                  muted
                  loop
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className={`absolute inset-0 bg-gradient-to-t ${m.header.replace('from-black', 'from-' + (mode === 'light' ? 'white' : 'black'))} via-transparent to-transparent pointer-events-none`} />
                
                <button 
                  onClick={() => setSelectedInfoVideo(null)}
                  className="absolute top-4 right-4 p-2 bg-black/60 rounded-full hover:bg-black/80 transition-colors z-50"
                >
                  <X className="w-5 h-5 md:w-6 md:h-6" />
                </button>

                <div className="absolute bottom-4 md:bottom-10 left-4 md:left-12 right-4 space-y-1.5 md:space-y-4">
                  <h2 className="text-lg md:text-5xl font-black tracking-tighter">{selectedInfoVideo.title}</h2>
                  <div className="flex items-center gap-1.5 md:gap-4">
                    <button 
                      onClick={() => { setCurrentVideo(selectedInfoVideo); setSelectedInfoVideo(null); }}
                      className="flex-1 md:flex-none flex items-center justify-center gap-1.5 md:gap-2 px-3 md:px-8 py-1.5 md:py-2.5 bg-white text-black rounded font-bold hover:bg-white/90 transition-colors text-[10px] md:text-sm"
                    >
                      <Play className="w-3 h-3 md:w-5 md:h-5 fill-current" /> Assistir
                    </button>
                    <button 
                      onClick={() => toggleFavorite(selectedInfoVideo)}
                      className={`p-1.5 md:p-2.5 rounded-full border border-white/40 hover:border-white transition-colors ${favorites.find(f => f.id === selectedInfoVideo.id) ? 'bg-white text-black' : 'bg-black/40'}`}
                    >
                      <Plus className="w-3 h-3 md:w-5 md:h-5" />
                    </button>
                    {customVideos.some(cv => cv.id === selectedInfoVideo.id) && (
                      <button 
                        onClick={() => {
                          handleRemoveFromList(selectedInfoVideo, 'home');
                          setSelectedInfoVideo(null);
                        }}
                        className="p-1.5 md:p-2.5 rounded-full border border-red-500/40 hover:bg-red-600 hover:border-red-600 transition-colors bg-red-500/20 text-red-400 hover:text-white"
                        title="Excluir vídeo Permanentemente"
                      >
                        <Trash2 className="w-3 h-3 md:w-5 md:h-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-4 md:p-12 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-8">
                <div className="md:col-span-2 space-y-2 md:space-y-6">
                  <div className="flex flex-wrap items-center gap-1.5 md:gap-3 text-[9px] md:text-sm font-bold">
                    <span className="text-green-500">98% relevante</span>
                    <span className="text-zinc-400">{selectedInfoVideo.year || '2026'}</span>
                    <span className="border border-zinc-500 px-1 py-0.5 text-[6px] md:text-[10px] rounded-sm">16+</span>
                    <span className="text-zinc-400">{selectedInfoVideo.duration || '1h 45min'}</span>
                    <span className="border border-zinc-500 px-1 py-0.5 text-[6px] md:text-[10px] rounded-sm uppercase">HD</span>
                  </div>
                  
                  <p className="text-[11px] md:text-lg text-zinc-200 leading-relaxed">
                    {selectedInfoVideo.description || (selectedInfoVideo.id === 'hero' 
                      ? "Em um futuro distópico, um grupo de sobreviventes descobre um sinal vindo de uma estação espacial abandonada que pode mudar o destino da humanidade."
                      : `Assista agora a ${selectedInfoVideo.title}. Uma obra-prima do gênero ${selectedInfoVideo.category || 'Streaming'}.`
                    )}
                  </p>
                </div>

                <div className="space-y-1.5 md:space-y-4 text-[9px] md:text-sm">
                  <div>
                    <span className="text-zinc-500">Elenco:</span> <span className="text-zinc-200 line-clamp-1 md:line-clamp-none">{selectedInfoVideo.cast || 'Lumina AI, Artistas Digitais'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Gêneros:</span> <span className="text-zinc-200">{selectedInfoVideo.category || 'Streaming'}</span>
                  </div>
                </div>
              </div>

              {/* More Like This Section */}
              <div className="px-4 md:px-12 pb-12 space-y-4 md:space-y-6">
                <h3 className="text-lg md:text-xl font-bold">Títulos semelhantes</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-[#2f2f2f] rounded-md overflow-hidden group cursor-pointer">
                      <div className="aspect-video relative">
                        <img src={`https://picsum.photos/seed/similar-${i}/400/225`} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="p-3 md:p-4 space-y-2">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="border border-zinc-500 px-1 py-0.5 text-[8px] rounded-sm">14+</span>
                            <span className="text-zinc-400 text-[8px] md:text-[10px]">2025</span>
                          </div>
                        </div>
                        <p className="text-[10px] text-zinc-400 line-clamp-2">Uma história paralela que explora os mesmos temas de coragem e descoberta.</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowSettings(false);
                setTimeout(() => setSettingsView('main'), 300);
              }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={`relative w-full md:max-w-4xl h-full md:h-[600px] ${m.glass} md:border md:rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row`}
            >
              {/* Sidebar / Top Nav on Mobile */}
              <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-white/5 flex flex-col">
                <div className="p-6 md:p-8 flex items-center justify-between md:block">
                  <h2 className="text-lg md:text-xl font-display font-black tracking-tight flex items-center gap-3">
                    <Settings className="w-5 h-5 md:w-6 md:h-6" />
                    CONFIGS
                  </h2>
                  <button 
                    onClick={() => setShowSettings(false)}
                    className="md:hidden p-2 hover:bg-white/5 rounded-full"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                
                <nav className="flex md:flex-col overflow-x-auto md:overflow-x-visible px-4 md:px-4 pb-4 md:pb-0 space-x-2 md:space-x-0 md:space-y-2 scrollbar-hide">
                  {[
                    { id: 'geral', label: 'Geral', icon: Settings },
                    { id: 'aparencia', label: 'Aparência', icon: Monitor },
                    { id: 'biblioteca', label: 'Biblioteca', icon: Tv },
                    { id: 'sobre', label: 'Sobre', icon: Info },
                    ...(isAdmin ? [{ id: 'admin', label: 'Admin', icon: Zap }] : [])
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setSettingsTab(tab.id as any);
                        setSettingsView('main');
                      }}
                      className={`flex-none md:w-full flex items-center gap-2 md:gap-3 px-4 py-2.5 md:py-3 rounded-xl transition-all font-bold text-xs md:text-sm ${
                        settingsTab === tab.id 
                          ? 'bg-white text-black shadow-lg shadow-white/10' 
                          : 'text-zinc-500 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <tab.icon className="w-4 h-4 md:w-5 md:h-5" />
                      {tab.label}
                    </button>
                  ))}
                </nav>

                <div className="hidden md:block p-8">
                  <button 
                    onClick={() => setShowSettings(false)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all font-black text-[10px] tracking-widest uppercase"
                  >
                    <X className="w-4 h-4" /> Fechar
                  </button>
                </div>
              </div>

              {/* Content Area */}
              <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <div className="flex-1 p-6 md:p-8 overflow-y-auto custom-scrollbar">
                {settingsView === 'main' ? (
                    <motion.div
                      key={settingsTab}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="space-y-8"
                    >
                      {settingsTab === 'geral' && (
                        <div className="space-y-6">
                          <div className="space-y-1">
                            <h3 className="text-lg font-bold">Configurações Gerais</h3>
                            <p className="text-xs text-zinc-500">Gerencie o comportamento básico do sistema</p>
                          </div>

                          <div className="space-y-4">
                            {user && (
                              <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                  <div className={`w-3 h-3 rounded-full ${
                                    syncStatus === 'synced' ? 'bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.5)]' : 
                                    syncStatus === 'syncing' ? 'bg-yellow-500 animate-pulse' : 
                                    'bg-red-500'
                                  }`} />
                                  <div className="flex flex-col">
                                    <span className="text-xs font-bold">Sincronização em Nuvem</span>
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">
                                      {syncStatus === 'synced' ? 'Conectado' : 'Desconectado'}
                                    </span>
                                  </div>
                                </div>
                                <span className="text-[10px] font-bold px-3 py-1 bg-white/5 rounded-full">
                                  {user.email}
                                </span>
                              </div>
                            )}

                            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-4">
                              <div className="flex items-center justify-between">
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold">Modo de Performance</span>
                                  <span className="text-[10px] text-zinc-500">Desativa efeitos pesados para hardware antigo</span>
                                </div>
                                <button 
                                  onClick={() => setIsLowEndMode(!isLowEndMode)}
                                  className={`w-12 h-6 rounded-full transition-all relative ${isLowEndMode ? 'bg-white' : 'bg-zinc-800'}`}
                                >
                                  <div className={`absolute top-1 w-4 h-4 rounded-full transition-all ${isLowEndMode ? 'right-1 bg-black' : 'left-1 bg-zinc-400'}`} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {settingsTab === 'aparencia' && (
                        <div className="space-y-6">
                          <div className="space-y-1">
                            <h3 className="text-lg font-bold">Personalização</h3>
                            <p className="text-xs text-zinc-500">Ajuste o visual da sua experiência</p>
                          </div>

                          <div className="grid grid-cols-1 gap-4">
                            <div className="p-6 bg-white/5 rounded-2xl border border-white/5 space-y-6">
                              <div className="flex items-center gap-3">
                                <Monitor className="w-5 h-5 text-zinc-400" />
                                <span className="text-sm font-bold">Tema do Sistema</span>
                              </div>
                              
                              <div className="grid grid-cols-3 gap-3">
                                {[
                                  { id: 'amoled', label: 'AMOLED', desc: 'Preto Puro' },
                                  { id: 'dark', label: 'Escuro', desc: 'Zinc Dark' },
                                  { id: 'light', label: 'Claro', desc: 'Zinc Light' }
                                ].map((item) => (
                                  <button 
                                    key={item.id}
                                    onClick={() => setMode(item.id as any)}
                                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                                      mode === item.id 
                                        ? 'bg-white text-black border-white' 
                                        : 'bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10'
                                    }`}
                                  >
                                    <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
                                    <span className="text-[8px] opacity-60 font-medium">{item.desc}</span>
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="p-6 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between">
                              <div className="flex flex-col">
                                <span className="text-sm font-bold">Protocolo LED</span>
                                <span className="text-[10px] text-zinc-500">Efeito de brilho dinâmico na interface</span>
                              </div>
                              <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-lg">
                                <Zap className="w-3 h-3 text-yellow-500" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Ativo</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {settingsTab === 'biblioteca' && (
                        <div className="space-y-6">
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <h3 className="text-lg font-bold">Sua Biblioteca</h3>
                              <p className="text-xs text-zinc-500">Gerencie seus conteúdos e fontes</p>
                            </div>
                            <button 
                              onClick={() => setSettingsView('add')}
                              className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-xl font-black text-[10px] tracking-widest uppercase hover:bg-zinc-200 transition-all"
                            >
                              <Plus className="w-4 h-4" /> Adicionar
                            </button>
                          </div>

                          <div className="space-y-4">
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between">
                              <div className="flex flex-col">
                                <span className="text-sm font-bold">Biblioteca Padrão</span>
                                <span className="text-[10px] text-zinc-500">Exibir os vídeos originais da Lumina</span>
                              </div>
                              <button 
                                onClick={() => setShowDefaultLibrary(!showDefaultLibrary)}
                                className={`w-12 h-6 rounded-full transition-all relative ${showDefaultLibrary ? 'bg-green-500' : 'bg-zinc-800'}`}
                              >
                                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${showDefaultLibrary ? 'left-7' : 'left-1'}`} />
                              </button>
                            </div>

                            <div className="space-y-3">
                              <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Vídeos Adicionados ({customVideos.length})</h4>
                              <div className="grid grid-cols-1 gap-2">
                                {customVideos.length > 0 ? customVideos.map(video => (
                                  <div key={video.id} className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5 group hover:bg-white/10 transition-all">
                                    <div className="flex items-center gap-4">
                                      <div className="w-16 aspect-video rounded-lg overflow-hidden bg-black border border-white/5">
                                        <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />
                                      </div>
                                      <div className="flex flex-col">
                                        <span className="text-xs font-bold truncate max-w-[200px]">{video.title}</span>
                                        <span className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">{video.type}</span>
                                      </div>
                                    </div>
                                    <button 
                                      onClick={() => setCustomVideos(prev => prev.filter(v => v.id !== video.id))}
                                      className="p-2 text-zinc-500 hover:text-red-500 transition-colors"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                )) : (
                                  <div className="text-center py-12 bg-white/5 rounded-2xl border border-dashed border-white/10">
                                    <Tv className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                                    <p className="text-xs text-zinc-600 font-medium">Nenhum vídeo personalizado</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {settingsTab === 'sobre' && (
                        <div className="space-y-8">
                          <div className="text-center space-y-4 py-8">
                            <div className="w-20 h-20 bg-white text-black rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-white/10 rotate-3">
                              <Tv className="w-10 h-10" />
                            </div>
                            <div className="space-y-1">
                              <h3 className="text-2xl font-display font-black tracking-tighter italic">LUMINA</h3>
                              <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.4em]">Streaming Experience</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-2">
                              <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Versão</span>
                              <p className="text-sm font-bold">2.4.0-stable</p>
                            </div>
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-2">
                              <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Build</span>
                              <p className="text-sm font-bold">2026.03.20</p>
                            </div>
                          </div>

                          <div className="p-6 bg-white text-black rounded-2xl flex items-center justify-between group cursor-pointer overflow-hidden relative">
                            <div className="relative z-10">
                              <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Desenvolvedor</span>
                              <p className="text-lg font-black tracking-tight">Victor3154k</p>
                            </div>
                            <Github className="w-12 h-12 opacity-10 absolute -right-2 -bottom-2 group-hover:scale-110 transition-transform" />
                            <button className="relative z-10 p-2 bg-black/5 rounded-full group-hover:bg-black/10 transition-colors">
                              <ChevronRight className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      )}

                      {settingsTab === 'admin' && isAdmin && (
                        <div className="space-y-8">
                          <div className="space-y-1">
                            <h3 className="text-lg font-bold">Painel de Administração</h3>
                            <p className="text-xs text-zinc-500">Controle total do sistema Lumina</p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-1">
                              <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Usuários</span>
                              <p className="text-2xl font-black">1.2k</p>
                            </div>
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-1">
                              <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Vídeos</span>
                              <p className="text-2xl font-black">450</p>
                            </div>
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-1">
                              <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Uptime</span>
                              <p className="text-2xl font-black">99.9%</p>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl space-y-4">
                              <div className="flex items-center gap-3 text-red-500">
                                <Zap className="w-5 h-5" />
                                <span className="text-sm font-bold uppercase tracking-widest">Controle Crítico</span>
                              </div>
                              <div className="flex flex-col gap-3">
                                <button className="w-full py-3 bg-red-500 text-white font-black text-[10px] tracking-widest uppercase rounded-xl hover:bg-red-600 transition-all">
                                  Reiniciar Servidores
                                </button>
                                <button className="w-full py-3 bg-white/10 text-white font-black text-[10px] tracking-widest uppercase rounded-xl hover:bg-white/20 transition-all">
                                  Limpar Cache Global
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </motion.div>
                ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-6"
                    >
                      <div className="flex items-center gap-4 mb-8">
                        <button 
                          onClick={() => setSettingsView('main')}
                          className="p-2 hover:bg-white/5 rounded-xl transition-colors"
                        >
                          <ChevronLeft className="w-6 h-6" />
                        </button>
                        <div className="space-y-1">
                          <h3 className="text-lg font-bold">Adicionar Vídeo</h3>
                          <p className="text-xs text-zinc-500">Insira os detalhes do novo conteúdo</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-6">
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Título</label>
                            <input 
                              type="text" 
                              value={newVideoTitle}
                              onChange={(e) => setNewVideoTitle(e.target.value)}
                              placeholder="Ex: Interestelar"
                              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 md:px-5 py-3 md:py-4 text-xs md:text-sm focus:outline-none focus:border-white/30 transition-all font-medium"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">URL do Vídeo</label>
                            <input 
                              type="text" 
                              value={newVideoUrl}
                              onChange={(e) => setNewVideoUrl(e.target.value)}
                              placeholder="https://exemplo.com/video.m3u8"
                              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 md:px-5 py-3 md:py-4 text-xs md:text-sm focus:outline-none focus:border-white/30 transition-all font-medium"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Thumbnail</label>
                            <input 
                              type="text" 
                              value={newVideoThumbnail}
                              onChange={(e) => setNewVideoThumbnail(e.target.value)}
                              placeholder="https://exemplo.com/thumb.jpg"
                              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 md:px-5 py-3 md:py-4 text-xs md:text-sm focus:outline-none focus:border-white/30 transition-all font-medium"
                            />
                          </div>
                        </div>

                        <button 
                          onClick={() => {
                            if (!newVideoTitle || !newVideoUrl) return;
                            const isHls = newVideoUrl.includes('.m3u8');
                            const newVideo: VideoItem = {
                              id: Math.random().toString(36).substr(2, 9),
                              title: newVideoTitle,
                              url: newVideoUrl,
                              thumbnail: newVideoThumbnail || `https://picsum.photos/seed/${newVideoTitle}/600/338`,
                              type: isHls ? 'hls' : 'mp4',
                              category: newVideoGenre || 'Adicionado',
                              cast: newVideoCast,
                              description: newVideoDescription,
                              year: newVideoYear
                            };
                            setCustomVideos(prev => [newVideo, ...prev]);
                            setNewVideoTitle('');
                            setNewVideoUrl('');
                            setNewVideoThumbnail('');
                            setSettingsView('main');
                          }}
                          className="w-full bg-white text-black font-black text-[10px] tracking-[0.2em] py-4 md:py-5 rounded-2xl hover:bg-zinc-200 transition-all uppercase shadow-xl shadow-white/5"
                        >
                          Salvar na Biblioteca
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

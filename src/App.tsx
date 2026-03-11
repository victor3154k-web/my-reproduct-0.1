import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mail, Lock, LogIn, Github, Chrome, Play, Music, 
  Heart, History, List, LogOut, User as UserIcon, 
  Search, Plus, Upload, ChevronRight, ChevronLeft, ArrowLeft, Settings,
  Volume2, Maximize, Pause, SkipForward, SkipBack, Cpu,
  Film, Tv, Monitor, Info, X, LayoutGrid, Star, Trash2
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
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsView, setSettingsView] = useState<'main' | 'add'>('main');
  const [selectedInfoVideo, setSelectedInfoVideo] = useState<VideoItem | null>(null);
  const [currentVideo, setCurrentVideo] = useState<VideoItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);
  
  // State for user data
  const [history, setHistory] = useState<VideoItem[]>([]);
  const [favorites, setFavorites] = useState<VideoItem[]>([]);
  const [playlist, setPlaylist] = useState<VideoItem[]>([]);
  const [customVideos, setCustomVideos] = useState<VideoItem[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error' | 'offline'>('synced');

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
  const hlsRef = useRef<Hls | null>(null);

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
    const combined = [...favorites, ...history.slice(0, 5), ...defaultHeroVideos];
    // Remove duplicates by ID
    return combined.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
  }, [favorites, history]);

  useEffect(() => {
    if (heroVideos.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentHeroIndex(prev => (prev + 1) % heroVideos.length);
    }, 8000); // Change every 8 seconds
    return () => clearInterval(interval);
  }, [heroVideos]);

  const currentHero = heroVideos[currentHeroIndex] || defaultHeroVideos[0];

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
      if (!currentUser) {
        // Clear local state on logout
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
          console.log("Dados carregados da nuvem com sucesso.");
        } else {
          console.log("Nenhum dado prévio encontrado na nuvem. Iniciando biblioteca vazia.");
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
  }, [history, favorites, playlist, customVideos, user, isDataLoaded]);

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
      bg: 'bg-[#000000]',
      card: 'bg-[#141414]',
      text: 'text-white',
      border: 'border-white/10',
      header: 'from-black/90 to-transparent',
      input: 'bg-white/5',
      muted: 'text-zinc-400'
    },
    dark: {
      bg: 'bg-[#141414]',
      card: 'bg-[#1f1f1f]',
      text: 'text-white',
      border: 'border-white/10',
      header: 'from-black/70 to-transparent',
      input: 'bg-white/10',
      muted: 'text-zinc-400'
    },
    light: {
      bg: 'bg-[#f5f5f5]',
      card: 'bg-white',
      text: 'text-[#141414]',
      border: 'border-black/10',
      header: 'from-white/90 to-transparent',
      input: 'bg-black/5',
      muted: 'text-zinc-500'
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
            
            <div className={`relative z-10 bg-[#0a0a0a] ${!isLowEndMode ? 'backdrop-blur-2xl bg-[#0a0a0a]/90' : ''} rounded-[22px] p-10 shadow-2xl border border-white/5`}>
              <div className="text-center mb-10">
                <motion.div
                  initial={isLowEndMode ? { opacity: 1, y: 0 } : { y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={isLowEndMode ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 20 }}
                  className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl ${current.accent} text-white mb-6 relative z-10 ${current.glow} ${!isLowEndMode ? 'shadow-[0_0_30px_rgba(0,0,0,0.5)]' : ''}`}
                >
                  {current.icon}
                </motion.div>
                
                <motion.h1 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-3xl font-display font-black tracking-tighter mb-2"
                >
                  LUMINA <span className={current.secondary}>ACESSO</span>
                </motion.h1>
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.3em]"
                >
                  {isSignUp ? 'Crie sua identidade digital' : 'Autentique-se para continuar'}
                </motion.p>
              </div>

              <form className="space-y-6 relative z-10" onSubmit={handleLogin}>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-1">Identidade</label>
                  <div className="relative group/input">
                    <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${theme === 'blue' ? 'group-focus-within/input:text-[#0066FF]' : 'group-focus-within/input:text-[#00FF66]'} text-zinc-600`} />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@lumina.com"
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-white/20 focus:bg-white/10 transition-all placeholder:text-zinc-800 font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Segredo</label>
                    {!isSignUp && <button type="button" className="text-[10px] text-zinc-600 hover:text-white transition-colors font-bold">Recuperar</button>}
                  </div>
                  <div className="relative group/input">
                    <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${theme === 'blue' ? 'group-focus-within/input:text-[#0066FF]' : 'group-focus-within/input:text-[#00FF66]'} text-zinc-600`} />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-white/20 focus:bg-white/10 transition-all placeholder:text-zinc-800 font-medium"
                    />
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  type="submit"
                  disabled={isLoading}
                  className={`w-full py-4 rounded-xl font-black text-xs tracking-[0.2em] transition-all disabled:opacity-50 bg-zinc-100 hover:bg-white text-black relative overflow-hidden group/btn`}
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {isLoading ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full"
                      />
                    ) : (
                      <>
                        {isSignUp ? 'REGISTRAR CONTA' : 'ENTRAR NO SISTEMA'} <LogIn className="w-4 h-4" />
                      </>
                    )}
                  </span>
                  <motion.div 
                    className="absolute inset-0 bg-black/5 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-1000"
                  />
                </motion.button>
              </form>

              <div className="mt-10 relative z-10">
                <div className="relative flex items-center justify-center mb-8">
                  <div className="absolute w-full h-px bg-white/5" />
                  <span className="relative px-4 bg-[#0d0d0d] text-[10px] font-black text-zinc-600 uppercase tracking-[0.4em]">Protocolo Externo</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <motion.button 
                    whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.2)' }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                    className="flex items-center justify-center gap-3 py-4 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black tracking-[0.2em] transition-all"
                  >
                    <Chrome className="w-4 h-4" /> GOOGLE
                  </motion.button>
                  <motion.button 
                    whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.2)' }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleGithubLogin}
                    disabled={isLoading}
                    className="flex items-center justify-center gap-3 py-4 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black tracking-[0.2em] transition-all"
                  >
                    <Github className="w-4 h-4" /> GITHUB
                  </motion.button>
                </div>

                <div className="mt-10 text-center">
                  <button 
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="text-[10px] font-black text-zinc-500 hover:text-white transition-colors uppercase tracking-[0.2em]"
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
      {/* Netflix Header */}
      <header className={`h-16 md:h-20 flex items-center justify-between px-4 md:px-12 fixed top-0 w-full z-50 transition-colors duration-300 bg-gradient-to-b ${m.header}`}>
        <div className="flex items-center gap-4 md:gap-10">
          <div className="cursor-pointer" onClick={() => setActiveTab('home')}>
            <h1 className="text-[#E50914] text-2xl md:text-3xl font-black tracking-tighter">LUMINA</h1>
          </div>

          <nav className="hidden md:flex items-center gap-5">
            {[
              { id: 'home', label: 'Início' },
              { id: 'favorites', label: 'Minha Lista' },
              { id: 'playlist', label: 'Playlist' },
              { id: 'history', label: 'Vistos' }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as Tab)}
                className={`text-sm transition-colors hover:${m.text} ${activeTab === item.id ? 'font-bold' : `font-normal ${m.muted}`}`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4 md:gap-6">
          <form onSubmit={handleUrlSubmit} className="hidden sm:flex items-center relative group">
            <Search className={`absolute left-3 w-4 h-4 ${m.text}`} />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Títulos, links..."
              className={`${m.input} border ${m.border} rounded-sm py-1.5 pl-10 pr-4 text-xs w-0 group-hover:w-64 focus:w-64 focus:outline-none focus:border-white transition-all duration-500 placeholder:text-zinc-500`}
            />
          </form>

          <label className="cursor-pointer p-1 rounded-md hover:bg-white/10 transition-colors group" title="Upload Local File">
            <Upload className="w-5 h-5 text-white" />
            <input type="file" accept="video/*,.m3u8" className="hidden" onChange={handleFileUpload} />
          </label>

          <div className="relative">
            <button 
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="w-8 h-8 rounded overflow-hidden transition-all"
            >
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Profile" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full bg-zinc-700 flex items-center justify-center text-xs font-bold">
                  {user?.email ? user.email.charAt(0).toUpperCase() : <UserIcon className="w-4 h-4" />}
                </div>
              )}
            </button>

            <AnimatePresence>
              {showProfileMenu && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className={`absolute right-0 mt-2 w-48 ${m.card} border ${m.border} shadow-2xl rounded-sm py-2 z-50`}
                >
                  <div className={`px-4 py-2 border-b ${m.border} mb-2`}>
                    <p className="text-xs font-bold truncate">{user?.displayName || 'Visitante'}</p>
                    <p className={`text-[10px] ${m.muted} truncate`}>{user?.email || 'Modo Offline'}</p>
                  </div>
                  <button className={`w-full text-left px-4 py-2 text-xs hover:${m.input}`}>Conta</button>
                  <button 
                    onClick={() => { setShowSettings(true); setShowProfileMenu(false); }}
                    className={`w-full text-left px-4 py-2 text-xs hover:${m.input}`}
                  >
                    Configurações
                  </button>
                  <button className={`w-full text-left px-4 py-2 text-xs hover:${m.input}`}>Centro de Ajuda</button>
                  <div className={`h-px ${m.border} my-2`} />
                  {user ? (
                    <button 
                      onClick={handleLogout}
                      className={`w-full text-left px-4 py-2 text-xs font-bold hover:${m.input} text-red-400`}
                    >
                      Sair da Lumina
                    </button>
                  ) : (
                    <button 
                      onClick={() => window.location.reload()}
                      className={`w-full text-left px-4 py-2 text-xs font-bold hover:${m.input} text-green-400`}
                    >
                      Entrar no Sistema
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {/* Billboard / Hero Section */}
        <section className="relative h-[56.25vw] md:h-[80vh] w-full overflow-hidden">
          {currentVideo ? (
            <div className="absolute inset-0 bg-black z-50">
              <video 
                ref={videoRef}
                className="w-full h-full object-contain"
                controls
                autoPlay
              />
              <button 
                onClick={() => setCurrentVideo(null)}
                className="absolute top-6 left-6 md:top-10 md:left-12 flex items-center gap-2 px-4 py-2 bg-black/50 rounded-md hover:bg-black/70 transition-colors z-20 text-white font-bold backdrop-blur-md border border-white/10"
              >
                <ArrowLeft className="w-5 h-5" /> Voltar
              </button>
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

              <div className="absolute bottom-[15%] left-4 md:left-12 max-w-xl space-y-4 md:space-y-6 z-10">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentHero.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.5 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center gap-2">
                      <div className="bg-[#E50914] p-0.5 rounded-sm">
                        <Play className="w-3 h-3 fill-current text-white" />
                      </div>
                      <span className={`text-xs font-bold tracking-widest uppercase ${m.muted}`}>
                        {currentHero.category || 'Original Lumina'}
                      </span>
                    </div>
                    
                    <h2 className="text-4xl md:text-7xl font-black tracking-tighter leading-none uppercase">
                      {currentHero.title}
                    </h2>
                    
                    <p className={`text-sm md:text-lg ${m.text} font-medium line-clamp-3 md:line-clamp-none drop-shadow-lg`}>
                      {currentHero.description || 'Uma história épica de coragem e descoberta em um universo em constante expansão.'}
                    </p>

                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setCurrentVideo(currentHero)}
                        className="flex items-center gap-2 px-6 md:px-8 py-2 md:py-3 bg-white text-black rounded font-bold hover:bg-white/90 transition-colors"
                      >
                        <Play className="w-5 h-5 fill-current" /> Assistir
                      </button>
                      <button 
                        onClick={() => setSelectedInfoVideo(currentHero)}
                        className={`flex items-center gap-2 px-6 md:px-8 py-2 md:py-3 ${m.input} ${m.text} rounded font-bold hover:bg-white/20 transition-colors backdrop-blur-md border ${m.border}`}
                      >
                        <Info className="w-5 h-5" /> Mais informações
                      </button>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </>
          )}
        </section>

        {/* Content Rows */}
        <div className="relative z-10 -mt-12 md:-mt-32 pb-20 space-y-10 md:space-y-16">
          {activeTab !== 'home' && (
            <div className="px-4 md:px-12 pt-4">
              <button 
                onClick={() => setActiveTab('home')}
                className={`flex items-center gap-2 ${m.muted} hover:${m.text} transition-colors text-sm font-bold`}
              >
                <ArrowLeft className="w-4 h-4" /> Voltar para o Início
              </button>
            </div>
          )}
          
          {[
            { id: 'home', title: 'Populares na Lumina', data: [
              ...customVideos,
              { id: '1', title: 'Big Buck Bunny', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', thumbnail: 'https://picsum.photos/seed/bunny/600/338', type: 'hls' as const },
              { id: '2', title: 'Elephants Dream', url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', thumbnail: 'https://picsum.photos/seed/elephant/600/338', type: 'mp4' as const },
              { id: '3', title: 'Sintel', url: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8', thumbnail: 'https://picsum.photos/seed/sintel/600/338', type: 'hls' as const },
              { id: '4', title: 'Tears of Steel', url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4', thumbnail: 'https://picsum.photos/seed/steel/600/338', type: 'mp4' as const },
              { id: '5', title: 'For Bigger Blazes', url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', thumbnail: 'https://picsum.photos/seed/fire/600/338', type: 'mp4' as const },
              { id: '6', title: 'For Bigger Escapes', url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', thumbnail: 'https://picsum.photos/seed/escape/600/338', type: 'mp4' as const }
            ]},
            { id: 'favorites', title: 'Minha Lista', data: favorites },
            { id: 'playlist', title: 'Playlist de Reprodução', data: playlist },
            { id: 'history', title: 'Continuar Assistindo', data: history }
          ].filter(row => activeTab === 'home' || row.id === activeTab).map((row, idx) => (
            <motion.div 
              key={idx} 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="px-4 md:px-12 space-y-2 md:space-y-4"
            >
              <h3 className="text-lg md:text-xl font-bold text-zinc-100 hover:text-white cursor-pointer inline-flex items-center gap-1 group">
                {row.title} <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all" />
              </h3>
              
              <div className="relative group/row">
                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-4 snap-x">
                  {row.data.length > 0 ? row.data.map((video) => (
                    <motion.div 
                      key={video.id}
                      layout
                      whileHover={{ 
                        scale: 1.05, 
                        zIndex: 20,
                        transition: { type: 'spring', stiffness: 400, damping: 25 }
                      }}
                      whileTap={{ scale: 0.98 }}
                      className="flex-none w-[45vw] md:w-[18vw] aspect-video relative rounded-sm overflow-hidden cursor-pointer snap-start shadow-lg"
                      onClick={() => setSelectedInfoVideo(video)}
                    >
                      <img 
                        src={video.thumbnail} 
                        alt={video.title} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/20 md:bg-black/40 opacity-100 md:opacity-0 md:hover:opacity-100 transition-opacity flex flex-col justify-end p-2 md:p-3">
                        {/* Always visible remove button for library rows on top right */}
                        {(row.id !== 'home' || customVideos.some(cv => cv.id === video.id)) && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleRemoveFromList(video, row.id); }}
                            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg hover:bg-red-700 transition-colors z-30 opacity-90 md:opacity-100"
                            title="Remover"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        
                        <div className="flex items-center gap-2 mb-1">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setCurrentVideo(video); }}
                            className="w-6 h-6 rounded-full border border-white flex items-center justify-center bg-white/10 hover:bg-white text-black transition-colors"
                          >
                            <Play className="w-3 h-3 fill-current" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); toggleFavorite(video); }}
                            className={`w-6 h-6 rounded-full border border-white flex items-center justify-center bg-white/10 ${favorites.find(f => f.id === video.id) ? 'bg-white text-black' : ''}`}
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setSelectedInfoVideo(video); }}
                            className="w-6 h-6 rounded-full border border-white flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors"
                          >
                            <Info className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="text-[10px] md:text-xs font-bold truncate">{video.title}</p>
                      </div>
                    </motion.div>
                  )) : (
                    <div className="w-full py-10 text-zinc-600 text-sm font-medium italic">
                      Nenhum título adicionado ainda.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className={`py-10 px-4 md:px-12 ${m.bg} border-t ${m.border} ${m.muted} text-xs`}>
        <div className="max-w-4xl space-y-6">
          <div className="flex gap-6">
            <Github className="w-5 h-5 cursor-pointer hover:text-white" />
            <Monitor className="w-5 h-5 cursor-pointer hover:text-white" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <span className="hover:underline cursor-pointer">Audiodescrição</span>
            <span className="hover:underline cursor-pointer">Relações com investidores</span>
            <span className="hover:underline cursor-pointer">Privacidade</span>
            <span className="hover:underline cursor-pointer">Entre em contato</span>
          </div>
          <p>© 2026 Lumina Streaming, Inc.</p>
        </div>
      </footer>

      {/* Info Modal (Netflix Style) */}
      <AnimatePresence>
        {selectedInfoVideo && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 md:p-10 overflow-y-auto">
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
              className={`relative w-full max-w-4xl ${m.card} rounded-xl shadow-2xl overflow-hidden`}
            >
              {/* Modal Header Image */}
              <div className="relative aspect-video w-full">
                <img 
                  src={selectedInfoVideo.thumbnail || 'https://picsum.photos/seed/info/1280/720'} 
                  alt={selectedInfoVideo.title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className={`absolute inset-0 bg-gradient-to-t ${m.header.replace('from-black', 'from-' + (mode === 'light' ? 'white' : 'black'))} via-transparent to-transparent`} />
                
                <button 
                  onClick={() => setSelectedInfoVideo(null)}
                  className="absolute top-4 right-4 p-2 bg-black/60 rounded-full hover:bg-black/80 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>

                <div className="absolute bottom-10 left-6 md:left-12 space-y-4">
                  <h2 className="text-3xl md:text-5xl font-black tracking-tighter">{selectedInfoVideo.title}</h2>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => { setCurrentVideo(selectedInfoVideo); setSelectedInfoVideo(null); }}
                      className="flex items-center gap-2 px-8 py-2.5 bg-white text-black rounded font-bold hover:bg-white/90 transition-colors"
                    >
                      <Play className="w-5 h-5 fill-current" /> Assistir
                    </button>
                    <button 
                      onClick={() => toggleFavorite(selectedInfoVideo)}
                      className={`p-2.5 rounded-full border border-white/40 hover:border-white transition-colors ${favorites.find(f => f.id === selectedInfoVideo.id) ? 'bg-white text-black' : 'bg-black/40'}`}
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                    {customVideos.some(cv => cv.id === selectedInfoVideo.id) && (
                      <button 
                        onClick={() => {
                          handleRemoveFromList(selectedInfoVideo, 'home');
                          setSelectedInfoVideo(null);
                        }}
                        className="p-2.5 rounded-full border border-red-500/40 hover:bg-red-600 hover:border-red-600 transition-colors bg-red-500/20 text-red-400 hover:text-white"
                        title="Excluir vídeo Permanentemente"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                    <button 
                      onClick={() => setSelectedInfoVideo(null)}
                      className="flex items-center gap-2 px-6 py-2.5 bg-zinc-500/50 text-white rounded font-bold hover:bg-zinc-500/70 transition-colors backdrop-blur-md border border-white/10"
                    >
                      <ArrowLeft className="w-5 h-5" /> Voltar
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6 md:p-12 grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2 space-y-6">
                  <div className="flex items-center gap-3 text-sm font-bold">
                    <span className="text-green-500">98% relevante</span>
                    <span className="text-zinc-400">{selectedInfoVideo.year || '2026'}</span>
                    <span className="border border-zinc-500 px-1.5 py-0.5 text-[10px] rounded-sm">16+</span>
                    <span className="text-zinc-400">{selectedInfoVideo.duration || '1h 45min'}</span>
                    <span className="border border-zinc-500 px-1.5 py-0.5 text-[10px] rounded-sm uppercase">HD</span>
                  </div>
                  
                  <p className="text-base md:text-lg text-zinc-200 leading-relaxed">
                    {selectedInfoVideo.description || (selectedInfoVideo.id === 'hero' 
                      ? "Em um futuro distópico, um grupo de sobreviventes descobre um sinal vindo de uma estação espacial abandonada que pode mudar o destino da humanidade. Uma jornada épica através do desconhecido onde cada decisão pode ser a última."
                      : `Assista agora a ${selectedInfoVideo.title}. Uma obra-prima do gênero ${selectedInfoVideo.category || 'Streaming'} que cativou audiências em todo o mundo com sua narrativa envolvente e visuais deslumbrantes.`
                    )}
                  </p>
                </div>

                <div className="space-y-4 text-sm">
                  <div>
                    <span className="text-zinc-500">Elenco:</span> <span className="text-zinc-200">{selectedInfoVideo.cast || 'Lumina AI, Artistas Digitais, Comunidade Open Source'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Gêneros:</span> <span className="text-zinc-200">{selectedInfoVideo.category || 'Streaming'}, Ação, Aventura</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Cenas e momentos:</span> <span className="text-zinc-200">Empolgantes, Visuais Incríveis</span>
                  </div>
                </div>
              </div>

              {/* More Like This Section */}
              <div className="px-6 md:px-12 pb-12 space-y-6">
                <h3 className="text-xl font-bold">Títulos semelhantes</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-[#2f2f2f] rounded-md overflow-hidden group cursor-pointer">
                      <div className="aspect-video relative">
                        <img src={`https://picsum.photos/seed/similar-${i}/400/225`} alt="" className="w-full h-full object-cover" />
                        <div className="absolute top-2 right-2 text-xs font-bold">1h 30min</div>
                      </div>
                      <div className="p-4 space-y-2">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="border border-zinc-500 px-1 py-0.5 text-[8px] rounded-sm">14+</span>
                            <span className="text-zinc-400 text-[10px]">2025</span>
                          </div>
                          <button className="p-1.5 rounded-full border border-white/20 hover:bg-white/10">
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-xs text-zinc-400 line-clamp-3">Uma história paralela que explora os mesmos temas de coragem e descoberta em um universo em constante expansão.</p>
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
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
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={`relative w-full max-w-lg ${m.card} border ${m.border} rounded-2xl shadow-2xl overflow-hidden`}
            >
              <div className={`flex items-center justify-between px-6 py-5 border-b ${m.border} ${m.input}`}>
                <div className="flex items-center gap-3">
                  {settingsView === 'add' && (
                    <button 
                      onClick={() => setSettingsView('main')}
                      className="p-1 hover:bg-white/10 rounded-full transition-colors"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                  )}
                  <h2 className="text-xl font-display font-black tracking-tight">
                    {settingsView === 'main' ? 'CONFIGURAÇÕES' : 'ADICIONAR CONTEÚDO'}
                  </h2>
                </div>
                <button onClick={() => {
                  setShowSettings(false);
                  setTimeout(() => setSettingsView('main'), 300);
                }} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                {settingsView === 'main' ? (
                  <div className="space-y-6">
                    {user && (
                      <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${
                            syncStatus === 'synced' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)]' : 
                            syncStatus === 'syncing' ? 'bg-yellow-500 animate-pulse' : 
                            'bg-red-500'
                          }`} />
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Status da Nuvem</span>
                            <span className="text-xs font-bold text-zinc-200">
                              {
                                syncStatus === 'synced' ? 'Sincronizado' : 
                                syncStatus === 'syncing' ? 'Sincronizando...' : 
                                syncStatus === 'offline' ? 'Firebase não configurado' :
                                'Erro na Sincronização'
                              }
                            </span>
                          </div>
                        </div>
                        {syncStatus === 'error' && (
                          <span className="text-[10px] text-red-400 max-w-[150px] text-right font-bold">
                            Verifique o Console Firestore.
                          </span>
                        )}
                      </div>
                    )}

                    <div className="space-y-2">
                      <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] mb-4">Biblioteca Pessoal</h3>
                      <button 
                        onClick={() => setSettingsView('add')}
                        className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-all group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Plus className="w-5 h-5" />
                          </div>
                          <div className="flex flex-col items-start">
                            <span className="text-sm font-bold">Adicionar Filmes ou Vídeos</span>
                            <span className="text-[10px] text-zinc-500 font-medium">HLS, MP4 ou Links Externos</span>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-white transition-colors" />
                      </button>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] mb-4">Preferências</h3>
                      
                      {/* Mode Switcher (AMOLED, Dark, Light) */}
                      <div className={`p-4 ${m.input} rounded-xl border ${m.border} space-y-4`}>
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-lg ${m.input} flex items-center justify-center`}>
                            <Monitor className="w-5 h-5" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold">Modo de Exibição</span>
                            <span className={`text-[10px] ${m.muted} font-medium`}>Escolha o estilo visual do app</span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: 'amoled', label: 'AMOLED' },
                            { id: 'dark', label: 'Escuro' },
                            { id: 'light', label: 'Claro' }
                          ].map((item) => (
                            <button 
                              key={item.id}
                              onClick={() => setMode(item.id as any)}
                              className={`flex items-center justify-center py-3 rounded-lg border transition-all text-[9px] font-black tracking-widest uppercase ${
                                mode === item.id 
                                  ? 'bg-white text-black border-white' 
                                  : `${m.input} ${m.border} ${m.muted} hover:bg-white/10`
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Performance Toggle */}
                      <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                            <Cpu className="w-5 h-5" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold">Modo de Performance</span>
                            <span className="text-[10px] text-zinc-500 font-medium">Otimizar para dispositivos lentos</span>
                          </div>
                        </div>
                        <button 
                          onClick={() => setIsLowEndMode(!isLowEndMode)}
                          className={`w-12 h-6 rounded-full transition-colors relative ${isLowEndMode ? 'bg-white' : 'bg-zinc-800'}`}
                        >
                          <div className={`absolute top-1 w-4 h-4 rounded-full transition-all ${isLowEndMode ? 'right-1 bg-black' : 'left-1 bg-zinc-400'}`} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-white/5">
                      <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] mb-4">Seus Vídeos Adicionados</h3>
                      <div className="space-y-2">
                        {customVideos.length > 0 ? customVideos.map(video => (
                          <div key={video.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 group">
                            <div className="flex items-center gap-3">
                              <div className="w-12 aspect-video rounded-lg overflow-hidden bg-black">
                                <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />
                              </div>
                              <div>
                                <p className="text-xs font-bold truncate w-40">{video.title}</p>
                                <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">{video.type}</p>
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
                          <p className="text-xs text-zinc-600 italic text-center py-4">Nenhum vídeo adicionado manualmente.</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Título do Vídeo</label>
                        <input 
                          type="text" 
                          value={newVideoTitle}
                          onChange={(e) => setNewVideoTitle(e.target.value)}
                          placeholder="Ex: Minha Live Favorita"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all placeholder:text-zinc-700 font-medium"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">URL (HLS ou MP4)</label>
                        <input 
                          type="text" 
                          value={newVideoUrl}
                          onChange={(e) => setNewVideoUrl(e.target.value)}
                          placeholder="https://exemplo.com/video.m3u8"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all placeholder:text-zinc-700 font-medium"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">URL da Thumbnail (Opcional)</label>
                        <input 
                          type="text" 
                          value={newVideoThumbnail}
                          onChange={(e) => setNewVideoThumbnail(e.target.value)}
                          placeholder="https://exemplo.com/imagem.jpg"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all placeholder:text-zinc-700 font-medium"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Ou Upload do Dispositivo</label>
                        <div className="flex items-center gap-2">
                          <label className="flex-1 cursor-pointer bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm hover:bg-white/10 transition-all flex items-center gap-2">
                            <Upload className="w-4 h-4 text-zinc-400" />
                            <span className="text-zinc-500 truncate font-medium">
                              {newVideoThumbnailFile ? newVideoThumbnailFile.name : 'Selecionar imagem...'}
                            </span>
                            <input 
                              type="file" 
                              accept="image/*" 
                              className="hidden" 
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setNewVideoThumbnailFile(file);
                                  setNewVideoThumbnail(''); 
                                }
                              }}
                            />
                          </label>
                          {newVideoThumbnailFile && (
                            <button 
                              onClick={() => setNewVideoThumbnailFile(null)}
                              className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-zinc-500 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="pt-2">
                        <button 
                          onClick={() => setShowAdvanced(!showAdvanced)}
                          className="flex items-center gap-2 text-[10px] font-black text-zinc-500 hover:text-white transition-colors uppercase tracking-widest"
                        >
                          <Settings className={`w-3 h-3 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} />
                          Opções Avançadas
                        </button>
                      </div>

                      <AnimatePresence>
                        {showAdvanced && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="space-y-4 overflow-hidden pt-2"
                          >
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Gênero</label>
                                <input 
                                  type="text" 
                                  value={newVideoGenre}
                                  onChange={(e) => setNewVideoGenre(e.target.value)}
                                  placeholder="Ex: Ação"
                                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 transition-all"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Ano</label>
                                <input 
                                  type="text" 
                                  value={newVideoYear}
                                  onChange={(e) => setNewVideoYear(e.target.value)}
                                  placeholder="Ex: 2026"
                                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 transition-all"
                                />
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Elenco</label>
                              <input 
                                type="text" 
                                value={newVideoCast}
                                onChange={(e) => setNewVideoCast(e.target.value)}
                                placeholder="Ex: Ator 1, Atriz 2"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 transition-all"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Sinopse</label>
                              <textarea 
                                value={newVideoDescription}
                                onChange={(e) => setNewVideoDescription(e.target.value)}
                                placeholder="Conte um pouco sobre o vídeo..."
                                rows={3}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 transition-all resize-none"
                              />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <motion.button 
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => {
                          if (!newVideoTitle || !newVideoUrl) return;
                          const isHls = newVideoUrl.includes('.m3u8');
                          
                          let finalThumbnail = newVideoThumbnail || `https://picsum.photos/seed/${newVideoTitle}/600/338`;
                          if (newVideoThumbnailFile) {
                            finalThumbnail = URL.createObjectURL(newVideoThumbnailFile);
                          }

                          const newVideo: VideoItem = {
                            id: Math.random().toString(36).substr(2, 9),
                            title: newVideoTitle,
                            url: newVideoUrl,
                            thumbnail: finalThumbnail,
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
                          setNewVideoThumbnailFile(null);
                          setNewVideoCast('');
                          setNewVideoGenre('');
                          setNewVideoDescription('');
                          setNewVideoYear('2026');
                          setShowAdvanced(false);
                          alert('Vídeo adicionado com sucesso!');
                          setSettingsView('main');
                        }}
                        className="w-full bg-white text-black font-black text-[10px] tracking-[0.2em] py-4 rounded-xl hover:bg-white/90 transition-all flex items-center justify-center gap-2 uppercase"
                      >
                        <Plus className="w-4 h-4" /> Adicionar à Biblioteca
                      </motion.button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

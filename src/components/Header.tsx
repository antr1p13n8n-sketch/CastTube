import React from 'react';
import { motion } from 'motion/react';
import {
  Plus,
  Sun,
  Moon,
  Monitor,
  FolderTree,
  Radio,
  Tv,
  LogIn,
  LogOut,
  Cloud,
  ListMusic,
  PictureInPicture2,
  Palette,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { ThemeMode, PlayerMode } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  onOpenThemeSettings?: () => void;
  onOpenAddModal: () => void;
  onOpenGroupModal: () => void;
  onOpenChannelDrawer: () => void;
  onOpenPlaylistModal: () => void;
  playlistCount: number;
  playerMode: PlayerMode;
  onTogglePlayerMode: () => void;
  activeFilterGroup: string;
  onSelectGroup: (groupId: string) => void;
  activeTab: 'feed' | 'player';
  onSelectTab: (tab: 'feed' | 'player') => void;
  user: User | null;
  authLoading: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  onOpenBackgroundAudioPopup?: () => void;
  backgroundAudioEnabled?: boolean;
  isFloatingOpen?: boolean;
  onToggleFloatingPopup?: () => void;
}

export const Header: React.FC<HeaderProps> = React.memo(({
  theme,
  onThemeChange,
  onOpenThemeSettings,
  onOpenAddModal,
  onOpenGroupModal,
  onOpenChannelDrawer,
  onOpenPlaylistModal,
  playlistCount,
  playerMode,
  activeTab,
  onSelectTab,
  user,
  authLoading,
  onSignIn,
  onSignOut,
  onOpenBackgroundAudioPopup,
  backgroundAudioEnabled = false,
  isFloatingOpen = false,
  onToggleFloatingPopup,
}) => {
  return (
    <header className="sticky top-0 z-30 w-full bg-white/85 dark:bg-slate-950/85 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 transition-colors duration-200">
      <div className="h-[2.5px] w-full casttube-gradient-bar opacity-90" />
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4 md:gap-8">
        {/* Zone 1: Brand Wordmark (Strict single element, no subtitle pill) */}
        <div className="flex items-center gap-3 shrink-0">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onSelectTab('feed');
            }}
            className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5 select-none group"
          >
            <motion.div
              whileHover={{ rotate: -8, scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 450, damping: 24 }}
              className="w-8 h-8 rounded-xl casttube-gradient-btn flex items-center justify-center"
            >
              <Radio className="w-4 h-4" />
            </motion.div>
            <span className="casttube-gradient-text">CastTube</span>
          </a>
        </div>

        {/* Zone 2: Navigation Links (Single-line controls) */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => onSelectTab('feed')}
            className={`relative py-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              activeTab === 'feed'
                ? 'casttube-accent-text font-bold'
                : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>Beranda Video</span>
            {activeTab === 'feed' && (
              <motion.span
                layoutId="headerActiveTab"
                transition={{ type: 'spring', stiffness: 480, damping: 36 }}
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full casttube-gradient-bar"
              />
            )}
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => onSelectTab('player')}
            className={`relative py-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'player'
                ? 'casttube-accent-secondary-text font-bold'
                : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {playerMode === 'audio' ? (
              <Radio className="w-4 h-4 casttube-accent-icon" />
            ) : (
              <Tv className="w-4 h-4 casttube-accent-secondary-text" />
            )}
            <span>Pemutar {playerMode === 'audio' ? 'Podcast' : 'Video'}</span>
            {activeTab === 'player' && (
              <motion.span
                layoutId="headerActiveTab"
                transition={{ type: 'spring', stiffness: 480, damping: 36 }}
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full casttube-gradient-bar"
              />
            )}
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={onOpenChannelDrawer}
            className="whitespace-nowrap shrink-0 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            Kelola Channel
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={onOpenGroupModal}
            className="whitespace-nowrap shrink-0 hover:text-amber-600 dark:hover:text-amber-300 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <FolderTree className="w-4 h-4 text-amber-500" />
            <span>Grup Channel</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={onOpenPlaylistModal}
            className="whitespace-nowrap shrink-0 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <ListMusic className="w-4 h-4 casttube-accent-icon" />
            <span>Playlist{playlistCount > 0 ? ` (${playlistCount})` : ''}</span>
          </motion.button>
        </nav>

        {/* Zone 3: Actions + Theme Selector + Auth */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {(onToggleFloatingPopup || onOpenBackgroundAudioPopup) && (
            <button
              type="button"
              onClick={onToggleFloatingPopup || onOpenBackgroundAudioPopup}
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                isFloatingOpen
                  ? 'casttube-gradient-btn'
                  : backgroundAudioEnabled
                  ? 'casttube-soft-surface casttube-accent-text border hover:brightness-105'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
              title={isFloatingOpen ? 'Tutup Popup Mengambang' : 'Aktifkan Popup Pemutar Mengambang'}
              aria-label={isFloatingOpen ? 'Tutup Popup Mengambang' : 'Aktifkan Popup Pemutar Mengambang'}
            >
              <PictureInPicture2 className={`w-3.5 h-3.5 ${isFloatingOpen ? '' : 'casttube-accent-icon'}`} />
              <span className="hidden lg:inline">{isFloatingOpen ? 'Popup Aktif' : 'Popup'}</span>
            </button>
          )}

          <PWAInstallButton />

          {/* Firebase Cloud Sync Auth Button */}
          {!authLoading && (
            user ? (
              <div className="flex items-center gap-2 bg-slate-100/90 dark:bg-slate-800/90 rounded-xl pl-2 pr-1.5 py-1 border border-slate-200/70 dark:border-slate-700/70">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Profil'}
                    referrerPolicy="no-referrer"
                    className="w-5 h-5 rounded-full object-cover shrink-0 border casttube-accent-border"
                  />
                ) : (
                  <Cloud className="w-4 h-4 text-emerald-500 shrink-0" />
                )}
                <span className="hidden lg:inline text-xs font-medium text-slate-700 dark:text-slate-200 max-w-[100px] truncate">
                  {user.displayName?.split(' ')[0] || 'Tersinkron'}
                </span>
                <button
                  onClick={onSignOut}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  title="Keluar dari Akun Google"
                  aria-label="Keluar dari Akun Google"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={onSignIn}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="Masuk dengan Google untuk menyimpan database di Firebase Cloud"
              >
                <LogIn className="w-3.5 h-3.5 casttube-accent-icon" />
                <span className="hidden sm:inline">Masuk Google</span>
              </button>
            )
          )}

          {/* Theme Mode + Custom Primary Theme Color Picker Trigger */}
          <div className="flex items-center bg-slate-100/90 dark:bg-slate-800/90 rounded-xl p-0.5 border border-slate-200/70 dark:border-slate-700/70">
            <button
              onClick={() => onThemeChange('system')}
              className={`relative p-1.5 rounded-lg transition-colors cursor-pointer ${
                theme === 'system'
                  ? 'casttube-accent-secondary-text'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Otomatis Sesuai Tema Sistem"
              aria-label="Tema Sistem"
            >
              {theme === 'system' && (
                <motion.span
                  layoutId="headerThemePill"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  className="absolute inset-0 rounded-lg bg-white dark:bg-slate-700 shadow-xs"
                />
              )}
              <Monitor className="relative z-10 w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onThemeChange('light')}
              className={`relative p-1.5 rounded-lg transition-colors cursor-pointer ${
                theme === 'light'
                  ? 'text-amber-500'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Mode Terang (Light)"
              aria-label="Mode Terang"
            >
              {theme === 'light' && (
                <motion.span
                  layoutId="headerThemePill"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  className="absolute inset-0 rounded-lg bg-white dark:bg-slate-700 shadow-xs"
                />
              )}
              <Sun className="relative z-10 w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onThemeChange('dark')}
              className={`relative p-1.5 rounded-lg transition-colors cursor-pointer ${
                theme === 'dark'
                  ? 'casttube-accent-icon'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Mode Gelap (Dark)"
              aria-label="Mode Gelap"
            >
              {theme === 'dark' && (
                <motion.span
                  layoutId="headerThemePill"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  className="absolute inset-0 rounded-lg bg-white dark:bg-slate-700 shadow-xs"
                />
              )}
              <Moon className="relative z-10 w-3.5 h-3.5" />
            </button>
            {onOpenThemeSettings && (
              <button
                type="button"
                onClick={onOpenThemeSettings}
                className="p-1.5 ml-0.5 rounded-lg casttube-accent-icon hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
                title="Pilih Warna Tema Utama"
                aria-label="Pilih Warna Tema Utama"
              >
                <Palette className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Primary Action Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold casttube-gradient-btn hover:brightness-110 rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer"
            title="Cari Video, Cari Channel, atau Tempel Link YouTube"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Cari &amp; Tambah</span>
          </motion.button>
        </div>
      </div>

      {/* Mobile & Installed PWA Navigation Bar */}
      <nav className="md:hidden border-t border-slate-100 dark:border-slate-800/80 px-2.5 py-1.5 flex items-center justify-start sm:justify-around gap-1 overflow-x-auto scrollbar-none text-xs font-semibold text-slate-600 dark:text-slate-300">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => onSelectTab('feed')}
          className={`relative flex items-center gap-1 px-2.5 py-1.5 rounded-lg whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
            activeTab === 'feed'
              ? 'casttube-accent-text font-bold'
              : 'hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          {activeTab === 'feed' && (
            <motion.span
              layoutId="headerMobileActiveTab"
              transition={{ type: 'spring', stiffness: 480, damping: 35 }}
              className="absolute inset-0 rounded-lg casttube-soft-surface border"
            />
          )}
          <span className="relative z-10">Beranda</span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => onSelectTab('player')}
          className={`relative flex items-center gap-1 px-2.5 py-1.5 rounded-lg whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
            activeTab === 'player'
              ? 'casttube-accent-secondary-text font-bold'
              : 'hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          {activeTab === 'player' && (
            <motion.span
              layoutId="headerMobileActiveTab"
              transition={{ type: 'spring', stiffness: 480, damping: 35 }}
              className="absolute inset-0 rounded-lg casttube-soft-surface border"
            />
          )}
          <span className="relative z-10 flex items-center gap-1">
            {playerMode === 'audio' ? (
              <Radio className="w-3.5 h-3.5 casttube-accent-icon" />
            ) : (
              <Tv className="w-3.5 h-3.5 casttube-accent-secondary-text" />
            )}
            <span>Pemutar</span>
          </span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onOpenChannelDrawer}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg whitespace-nowrap shrink-0 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <span>Channel</span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onOpenGroupModal}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg whitespace-nowrap shrink-0 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors cursor-pointer"
        >
          <FolderTree className="w-3.5 h-3.5 text-amber-500" />
          <span>Grup</span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onOpenPlaylistModal}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg whitespace-nowrap shrink-0 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <ListMusic className="w-3.5 h-3.5 casttube-accent-icon" />
          <span>Playlist{playlistCount > 0 ? ` (${playlistCount})` : ''}</span>
        </motion.button>

        {(onToggleFloatingPopup || onOpenBackgroundAudioPopup) && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onToggleFloatingPopup || onOpenBackgroundAudioPopup}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg whitespace-nowrap shrink-0 transition-all cursor-pointer ${
              isFloatingOpen
                ? 'casttube-gradient-btn font-bold'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <PictureInPicture2 className={`w-3.5 h-3.5 ${isFloatingOpen ? '' : 'casttube-accent-icon'}`} />
            <span>{isFloatingOpen ? 'Popup Aktif' : 'Popup'}</span>
          </motion.button>
        )}
      </nav>
    </header>
  );
});

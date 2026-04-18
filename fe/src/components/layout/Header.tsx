import { useAuthStore } from "@/store/authStore";
import { useFYStore } from "@/store/fyStore";
import { useDateStore } from "@/store/dateStore";
import { useThemeStore } from "@/store/themeStore";
import { authApi } from "@/api/auth";
import { useSync } from "@/hooks/useSync";
import { useTheme } from "@/contexts/ThemeContext";
import {
  LogOut,
  User,
  Wifi,
  WifiOff,
  RefreshCw,
  CloudOff,
  Sun,
  Moon,
  Settings,
  Menu,
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function Header({
  onMobileMenuToggle,
}: {
  onMobileMenuToggle?: () => void;
}) {
  const { user, logout } = useAuthStore();
  const { selectedFY, allFYs, setSelectedFY } = useFYStore();
  const { selectedDate, setSelectedDate, resetToToday } = useDateStore();
  const { showSidebar, setSidebarVisibility } = useThemeStore();
  const companyName = user?.company?.name?.trim() || "ERP";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isOnline, isSyncing, pendingCount, doSync } = useSync();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showFYDropdown, setShowFYDropdown] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fyDropdownRef = useRef<HTMLDivElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);

  const formatHeaderDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    });
  };

  const localDateStr = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() + days);
    setSelectedDate(localDateStr(d));
  };

  const todayStr = localDateStr(new Date());
  const isToday = selectedDate === todayStr;

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } finally {
      logout();
      navigate("/login");
    }
  };

  const handleNavigateToSettings = () => {
    setShowDropdown(false);
    navigate("/settings/base");
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
      if (
        fyDropdownRef.current &&
        !fyDropdownRef.current.contains(event.target as Node)
      ) {
        setShowFYDropdown(false);
      }
      if (
        datePickerRef.current &&
        !datePickerRef.current.contains(event.target as Node)
      ) {
        setShowDatePicker(false);
      }
    };

    if (showDropdown || showFYDropdown || showDatePicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDropdown, showFYDropdown, showDatePicker]);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 sm:px-6 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center gap-3">
        <button
          onClick={onMobileMenuToggle}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        {/* Overlay Sidebar Toggle - appears when sidebar is hidden on desktop */}
        {!showSidebar && (
          <button
            onClick={onMobileMenuToggle}
            className="hidden rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-300 md:block"
            title="Open sidebar"
          >
            <Menu className="h-4 w-4" />
          </button>
        )}
        <div>
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {companyName}
          </h2>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Date Selector */}
        <div className="relative" ref={datePickerRef}>
          <div className="flex items-center rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20">
            <button
              onClick={() => shiftDate(-1)}
              className="rounded-l-lg p-1.5 text-amber-600 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/40"
              title="Previous day"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="flex items-center gap-1.5 px-1.5 py-1.5 text-xs font-semibold text-amber-700 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200"
              title="Select working date"
            >
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline whitespace-nowrap">
                {formatHeaderDate(selectedDate)}
              </span>
            </button>
            <button
              onClick={() => shiftDate(1)}
              className="rounded-r-lg p-1.5 text-amber-600 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/40"
              title="Next day"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {showDatePicker && (
            <div className="absolute right-0 mt-1 w-64 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
              <div className="border-b border-gray-100 px-3 py-2 dark:border-gray-700">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Working Date
                </p>
              </div>
              <div className="p-3 space-y-3">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedDate(e.target.value);
                      setShowDatePicker(false);
                    }
                  }}
                  className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm text-gray-700 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:focus:border-amber-500"
                />
                {!isToday && (
                  <button
                    onClick={() => {
                      resetToToday();
                      setShowDatePicker(false);
                    }}
                    className="w-full rounded-md bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50"
                  >
                    Reset to Today
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* FY Selector */}
        {selectedFY && (
          <div className="relative" ref={fyDropdownRef}>
            <button
              onClick={() => setShowFYDropdown(!showFYDropdown)}
              className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1.5 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50 sm:px-2.5"
            >
              <Calendar className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">FY {selectedFY.label}</span>
              <svg
                className={`h-3 w-3 transition-transform hidden sm:block ${showFYDropdown ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {showFYDropdown && (
              <div className="absolute right-0 mt-1 w-52 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                <div className="border-b border-gray-100 px-3 py-2 dark:border-gray-700">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                    Switch Financial Year
                  </p>
                </div>
                <div className="max-h-60 overflow-y-auto py-1">
                  {allFYs.map((fy) => (
                    <button
                      key={fy.id}
                      onClick={() => {
                        if (selectedFY?.id !== fy.id) {
                          setSelectedFY(fy);
                          // Invalidate all queries so data refetches with the new FY
                          queryClient.invalidateQueries({
                            predicate: (query) =>
                              query.queryKey[0] !== "financial-years",
                          });
                        }
                        setShowFYDropdown(false);
                      }}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                        selectedFY.id === fy.id
                          ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                          : "text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700"
                      }`}
                    >
                      <span className="font-medium">FY {fy.label}</span>
                      <span className="flex items-center gap-1">
                        {fy.is_current && (
                          <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            Current
                          </span>
                        )}
                        {selectedFY.id === fy.id && (
                          <svg
                            className="h-4 w-4 text-indigo-600 dark:text-indigo-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sidebar Toggle */}
        <button
          onClick={() => setSidebarVisibility(!showSidebar)}
          className="hidden rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-300 md:block"
          title={showSidebar ? "Hide sidebar" : "Show sidebar"}
        >
          {showSidebar ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        {/* POS button */}
        {/* <button
          onClick={() => navigate('/pos')}
          className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
          title="Open POS"
        >
          <ShoppingCart className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">POS</span>
        </button> */}

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          title={
            resolvedTheme === "light"
              ? "Switch to dark theme"
              : "Switch to light theme"
          }
        >
          {resolvedTheme === "light" ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
        </button>

        {/* Sync Status Badge */}
        <button
          onClick={doSync}
          disabled={!isOnline || isSyncing}
          className="hidden items-center gap-1.5 rounded-lg border border-gray-200 px-2 py-1 text-xs font-medium transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800 sm:flex sm:px-3 sm:py-1.5"
          title={isOnline ? "Click to sync" : "Offline"}
        >
          {!isOnline ? (
            <>
              <WifiOff className="h-3.5 w-3.5 text-red-500" />
              <span className="text-red-600 dark:text-red-400">Offline</span>
            </>
          ) : isSyncing ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary-500" />
              <span className="text-primary-600 dark:text-primary-400">
                Syncing...
              </span>
            </>
          ) : pendingCount > 0 ? (
            <>
              <CloudOff className="h-3.5 w-3.5 text-yellow-500" />
              <span className="text-yellow-600 dark:text-yellow-400">
                {pendingCount}
              </span>
            </>
          ) : (
            <>
              <Wifi className="h-3.5 w-3.5 text-green-500" />
              <span className="text-green-600 dark:text-green-400">Synced</span>
            </>
          )}
        </button>

        {/* Profile Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300">
              {user?.profile_image_url ? (
                <img
                  src={user.profile_image_url}
                  alt={user.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <User className="h-4 w-4" />
              )}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                {user?.name}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 capitalize">
                {user?.role}
              </p>
            </div>
            <svg
              className={`h-4 w-4 text-gray-500 transition-transform dark:text-gray-400 ${showDropdown ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {showDropdown && (
            <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
              <div className="border-b border-gray-100 p-3 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Logged in as
                </p>
                <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                  {user?.name}
                </p>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                  {user?.email}
                </p>
              </div>
              <div>
                <button
                  onClick={handleNavigateToSettings}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  <Settings className="h-4 w-4" />
                  My Profile & Settings
                </button>
              </div>
              <div className="border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

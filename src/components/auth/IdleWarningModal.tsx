import React from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { AlertCircle, Clock } from 'lucide-react';

interface IdleWarningModalProps {
  isOpen: boolean;
  secondsRemaining: number;
  onStayLoggedIn: () => void;
}

export function IdleWarningModal({ isOpen, secondsRemaining, onStayLoggedIn }: IdleWarningModalProps) {
  if (!isOpen) return null;

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeDisplay = minutes > 0 
    ? `${minutes}:${seconds.toString().padStart(2, '0')}`
    : `${seconds}s`;

  return createPortal(
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]"
      style={{ zIndex: 2147483647 }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-orange-200/50 overflow-hidden animate-in fade-in zoom-in duration-300">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-8 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <AlertCircle className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Session Timeout Warning</h2>
          <p className="text-orange-100 text-sm">
            Your session is about to expire due to inactivity
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Countdown Display */}
          <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-6 text-center border border-orange-200">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-orange-600" />
              <p className="text-sm font-medium text-orange-800">Time Remaining</p>
            </div>
            <div className="text-5xl font-bold text-orange-600 tabular-nums">
              {timeDisplay}
            </div>
          </div>

          {/* Message */}
          <div className="text-center space-y-2">
            <p className="text-gray-700 font-medium">
              You will be automatically logged out for security purposes
            </p>
            <p className="text-sm text-gray-500">
              Click "Stay Logged In" to continue your session
            </p>
          </div>

          {/* Action Button */}
          <Button
            onClick={onStayLoggedIn}
            className="w-full h-12 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white rounded-lg font-semibold text-base shadow-lg hover:shadow-xl transition-all duration-200"
          >
            Stay Logged In
          </Button>

          {/* Info */}
          <p className="text-xs text-center text-gray-400">
            Any unsaved changes may be lost if you are logged out
          </p>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 text-center border-t border-gray-200">
          <p className="text-xs text-gray-500 flex items-center justify-center gap-1">
            <span>🔒</span>
            <span>Auto-logout is a security feature to protect your account</span>
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}


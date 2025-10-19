// client/app/components/server-key-status.tsx
'use client';

import { useState, useEffect } from 'react';
import { ServerKeyValidatorIntegration } from '../utils/ServerKeyValidatorIntegration';

interface ServerKeyStatusProps {
  showDetails?: boolean;
}

export function ServerKeyStatus({ showDetails = false }: ServerKeyStatusProps) {
  const [validation, setValidation] = useState<any>(null);
  const [maskedKey, setMaskedKey] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const validator = new ServerKeyValidatorIntegration();
    
    try {
      const validationResult = validator.validateCurrentConfiguration();
      const masked = validator.getMaskedCurrentKey();
      
      setValidation(validationResult);
      setMaskedKey(masked);
    } catch (error) {
      console.error('Failed to validate server key:', error);
      setValidation({ isValid: false, error: 'Validation failed' });
    } finally {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center space-x-2 text-gray-500">
        <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
        <span>Validating server key...</span>
      </div>
    );
  }

  const statusColor = validation?.isValid ? 'text-green-600' : 'text-red-600';
  const statusIcon = validation?.isValid ? '✅' : '❌';
  const statusText = validation?.isValid ? 'Valid' : 'Invalid';

  return (
    <div className="space-y-2">
      <div className={`flex items-center space-x-2 ${statusColor}`}>
        <span>{statusIcon}</span>
        <span className="font-medium">Server Key: {statusText}</span>
      </div>
      
      {showDetails && (
        <div className="text-sm text-gray-600 space-y-1">
          <div>Key: <code className="bg-gray-100 px-1 rounded">{maskedKey}</code></div>
          {!validation?.isValid && validation?.error && (
            <div className="text-red-600">
              Error: {validation.error}
            </div>
          )}
          {!validation?.isValid && validation?.recommendation && (
            <div className="text-blue-600">
              💡 {validation.recommendation}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
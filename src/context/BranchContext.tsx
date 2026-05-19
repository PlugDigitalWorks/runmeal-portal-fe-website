'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Branch } from '@/types/branch';
import { useUser } from './UserContext';

interface BranchContextType {
    selectedBranch: Branch | null;
    setSelectedBranch: (branch: Branch | null) => void;
    isLoading: boolean;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export function BranchProvider({ children }: { children: React.ReactNode }) {
    const { addresses } = useUser();
    const [selectedBranch, setSelectedBranchState] = useState<Branch | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Load guest branch from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem('guest_branch');
        if (stored) {
            try {
                const branch = JSON.parse(stored);
                setSelectedBranchState(branch);
            } catch (e) {
                console.error("Failed to parse guest branch", e);
            }
        }
    }, []);

    const setSelectedBranch = useCallback((branch: Branch | null) => {
        setSelectedBranchState(branch);
        if (branch) {
            localStorage.setItem('guest_branch', JSON.stringify(branch));
        } else {
            localStorage.removeItem('guest_branch');
        }
    }, []);

    return (
        <BranchContext.Provider value={{ selectedBranch, setSelectedBranch, isLoading }}>
            {children}
        </BranchContext.Provider>
    );
}

export function useBranch() {
    const context = useContext(BranchContext);
    if (context === undefined) {
        throw new Error('useBranch must be used within a BranchProvider');
    }
    return context;
}

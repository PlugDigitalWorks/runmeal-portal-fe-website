'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { AlertCircle, MapPin, User as UserIcon } from 'lucide-react';

import { ContactForm } from '@/components/contact/ContactForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useBranch } from '@/context/BranchContext';
import { useUser } from '@/context/UserContext';
import { branchService } from '@/services/branch.service';
import type { Branch } from '@/types/branch';
import { hasCompleteContactIdentity } from '@/types/contact';

/** Blocking states share one layout so the page never jumps between shapes. */
function ContactNotice({
  icon: Icon,
  title,
  description,
  actionHref,
  actionLabel,
}: {
  icon: typeof AlertCircle;
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <div className="p-6 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-orange-600">
        <Icon className="h-5 w-5" />
      </span>
      <h2 className="mt-4 text-lg font-bold text-zinc-900">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-zinc-500">{description}</p>
      <Link
        href={actionHref}
        className="mt-5 inline-flex items-center justify-center rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-orange-700"
      >
        {actionLabel}
      </Link>
    </div>
  );
}

export default function ContactView() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const { user, isLoading: isUserLoading } = useUser();
  const { selectedBranch, isLoading: isBranchLoading } = useBranch();

  // A branch can be linked to directly from its page; otherwise fall back to the
  // branch the user is already shopping.
  const branchIdParam = searchParams.get('branchId');
  const needsLookup = Boolean(branchIdParam) && branchIdParam !== selectedBranch?.id;
  const [linkedBranch, setLinkedBranch] = useState<Branch | null>(null);
  const [failedBranchId, setFailedBranchId] = useState<string | null>(null);

  useEffect(() => {
    if (!needsLookup || !branchIdParam) return;

    let isCurrent = true;
    branchService
      .getBranchDetails(branchIdParam)
      .then((branch) => {
        if (isCurrent) setLinkedBranch(branch);
      })
      .catch((error) => {
        console.error(`Failed to fetch branch ${branchIdParam}`, error);
        if (isCurrent) setFailedBranchId(branchIdParam);
      });

    return () => {
      isCurrent = false;
    };
  }, [needsLookup, branchIdParam]);

  // Derived rather than stored, so switching branches never renders the previous
  // one while the new lookup is still in flight.
  const resolvedLinkedBranch = linkedBranch?.id === branchIdParam ? linkedBranch : null;
  const isLinkedBranchLoading = needsLookup && !resolvedLinkedBranch && failedBranchId !== branchIdParam;

  const branch = needsLookup ? resolvedLinkedBranch : selectedBranch;
  const isLoading = isUserLoading || isBranchLoading || isLinkedBranchLoading;

  const body = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center gap-3 p-10 text-sm text-zinc-500">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-orange-600 border-t-transparent" />
          {t('contact.loading')}
        </div>
      );
    }

    if (!user) {
      return (
        <ContactNotice
          icon={UserIcon}
          title={t('contact.authRequired.title')}
          description={t('contact.authRequired.description')}
          actionHref="/login"
          actionLabel={t('contact.authRequired.action')}
        />
      );
    }

    // The API reads name, surname and e-mail off the account and rejects the
    // request when any is blank, so we say that up front instead of letting the
    // user write a message that cannot be delivered.
    if (!hasCompleteContactIdentity(user)) {
      return (
        <ContactNotice
          icon={AlertCircle}
          title={t('contact.incompleteProfile.title')}
          description={t('contact.incompleteProfile.description')}
          actionHref="/profile"
          actionLabel={t('contact.incompleteProfile.action')}
        />
      );
    }

    if (!branch) {
      return (
        <ContactNotice
          icon={MapPin}
          title={t('contact.noBranch.title')}
          description={t('contact.noBranch.description')}
          actionHref="/"
          actionLabel={t('contact.noBranch.action')}
        />
      );
    }

    return (
      <CardContent className="pt-6">
        <ContactForm branchId={branch.id} branchName={branch.name} brandId={branch.brandId} />
      </CardContent>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        <Card className="border-zinc-200 shadow-sm">
          <CardHeader className="border-b border-zinc-100 pb-4">
            <CardTitle className="text-xl">{t('contact.title')}</CardTitle>
            <p className="text-sm text-zinc-500">{t('contact.subtitle')}</p>
          </CardHeader>
          {body()}
        </Card>
      </div>
    </div>
  );
}

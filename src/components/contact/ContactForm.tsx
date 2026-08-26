'use client';

import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import { Send } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { contactService } from '@/services/contact.service';
import { resolveApiErrorMessage } from '@/lib/api-errors';
import { CONTACT_MESSAGE_MAX_LENGTH } from '@/types/contact';

// Same shape the address form validates against, so a phone accepted there is
// accepted here. An empty string is valid: the backend then falls back to the
// user's active address phone.
const PHONE_E164 = /^\+[1-9]\d{7,14}$/;

const createContactSchema = (t: TFunction) =>
  z.object({
    phoneE164: z
      .string()
      .trim()
      .refine((value) => value === '' || PHONE_E164.test(value), t('contact.validation.phoneFormat')),
    message: z
      .string()
      .trim()
      .min(1, t('contact.validation.messageRequired'))
      .max(CONTACT_MESSAGE_MAX_LENGTH, t('contact.validation.messageMax')),
  });

type ContactFormValues = z.infer<ReturnType<typeof createContactSchema>>;

interface ContactFormProps {
  branchId: string;
  branchName: string;
  brandId?: string;
}

export function ContactForm({ branchId, branchName, brandId }: ContactFormProps) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(createContactSchema(t)),
    defaultValues: { phoneE164: '', message: '' },
  });

  // useWatch keeps the counter reactive without the non-memoizable watch().
  const messageLength = (useWatch({ control, name: 'message' }) ?? '').length;

  const onSubmit = handleSubmit(async (values) => {
    try {
      await contactService.createContactRequest(
        branchId,
        {
          message: values.message,
          // Sending an empty phone would fail validation; leaving the key out is
          // what triggers the backend's address-phone fallback.
          ...(values.phoneE164 ? { phoneE164: values.phoneE164 } : {}),
        },
        brandId,
      );
      toast.success(t('contact.toast.success'));
      reset({ phoneE164: '', message: '' });
    } catch (error) {
      console.error('Contact request failed', error);
      toast.error(resolveApiErrorMessage(error, t('contact.toast.failed')));
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {t('contact.branchLabel')}
        </p>
        <p className="mt-1 break-words font-semibold text-zinc-900">{branchName}</p>
      </div>

      <div>
        <Input
          id="contact-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          label={`${t('contact.phoneLabel')} ${t('contact.optional')}`}
          placeholder="+905551234567"
          error={errors.phoneE164?.message}
          aria-describedby="contact-phone-hint"
          {...register('phoneE164')}
        />
        <p id="contact-phone-hint" className="mt-1 text-xs text-zinc-500">
          {t('contact.phoneHint')}
        </p>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <label htmlFor="contact-message" className="text-sm font-medium leading-none text-zinc-700">
            {t('contact.messageLabel')}
          </label>
          <span className="text-xs tabular-nums text-zinc-400">
            {messageLength} / {CONTACT_MESSAGE_MAX_LENGTH}
          </span>
        </div>
        <textarea
          id="contact-message"
          rows={6}
          maxLength={CONTACT_MESSAGE_MAX_LENGTH}
          placeholder={t('contact.messagePlaceholder')}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? 'contact-message-error' : undefined}
          className={`w-full resize-none rounded-lg border bg-white px-3 py-2 text-sm ring-offset-white transition-all duration-200 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
            errors.message
              ? 'border-red-500 focus-visible:ring-red-500'
              : 'border-zinc-300 focus-visible:ring-orange-500'
          }`}
          {...register('message')}
        />
        {errors.message && (
          <p id="contact-message-error" role="alert" className="mt-1 text-xs font-medium text-red-500">
            {errors.message.message}
          </p>
        )}
      </div>

      <Button type="submit" isLoading={isSubmitting} className="w-full">
        {isSubmitting ? (
          t('contact.submitting')
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" />
            {t('contact.submit')}
          </>
        )}
      </Button>
    </form>
  );
}

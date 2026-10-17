import time
from datetime import timedelta
from urllib.parse import urlsplit

from django.conf import settings
from django.contrib.auth.forms import PasswordResetForm
from django.core.management.base import BaseCommand, CommandError
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils import timezone

from accounts.models import PasswordResetRequest


class QueuedResetForm(PasswordResetForm):
    def send_mail(self, subject_template_name, email_template_name, context,
                  from_email, to_email, html_email_template_name=None):
        # Propagate transport failures so the queue can retry. Django's default
        # form logs and swallows them, which would discard a failed request.
        subject = ''.join(render_to_string(subject_template_name, context).splitlines())
        body = render_to_string(email_template_name, context)
        if send_mail(subject, body, from_email, [to_email]) != 1:
            raise RuntimeError('Email backend did not accept the message')


class Command(BaseCommand):
    help = 'Send queued password resets. Run one worker; --once processes one batch.'

    def add_arguments(self, parser):
        parser.add_argument('--once', action='store_true')

    def handle(self, *args, **options):
        if settings.PASSWORD_RESET_DELIVERY == 'unconfigured':
            raise CommandError('Configure email delivery before starting this worker.')
        origin = urlsplit(settings.PASSWORD_RESET_BASE_URL)
        if (origin.scheme not in ('http', 'https') or not origin.netloc
                or origin.path not in ('', '/') or origin.query or origin.fragment
                or origin.username or origin.password
                or (not settings.DEBUG and origin.scheme != 'https')):
            raise CommandError('PASSWORD_RESET_BASE_URL must be a trusted origin (HTTPS in production).')
        while True:
            # Bound queue retention, including failures, and never store tokens.
            PasswordResetRequest.objects.filter(
                created_at__lt=timezone.now() - timedelta(hours=1)).delete()
            for item in PasswordResetRequest.objects.order_by('pk')[:100]:
                form = QueuedResetForm({'email': item.email})
                try:
                    if form.is_valid():
                        form.save(domain_override=origin.netloc,
                                  use_https=origin.scheme == 'https',
                                  from_email=settings.DEFAULT_FROM_EMAIL,
                                  email_template_name='registration/password_reset_email.txt')
                    item.delete()
                except Exception as exc:
                    item.attempts += 1
                    self.stderr.write(f'Reset request {item.pk}: {type(exc).__name__}; attempt {item.attempts}/3')
                    if item.attempts >= 3:
                        item.delete()
                    else:
                        item.save(update_fields=['attempts'])
            if options['once']:
                return
            time.sleep(10)

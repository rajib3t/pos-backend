import nodemailer, { Transporter } from 'nodemailer';
import Logging from '../libraries/logging.library';
import { mailConfig } from '../config';

export interface TemplatePayload {
  template?: string;
  templateData?: any;
  subject: string;
  to: string | string[];
  from?: string;
  body?: string;
}

class MailService {
  private static instance: MailService;
  private transporter!: Transporter;
  private initialized = false;

  private constructor() {}

  public static getInstance(): MailService {
    if (!MailService.instance) {
      MailService.instance = new MailService();
      MailService.instance.initialize();
    }
    return MailService.instance;
  }

  private initialize() {
    try {
      this.transporter = nodemailer.createTransport({
        host: mailConfig.host,
        port: mailConfig.port,
        secure: mailConfig.secure,
        auth: mailConfig.user && mailConfig.pass ? { user: mailConfig.user, pass: mailConfig.pass } : undefined,
      });
      this.initialized = true;
      Logging.info('Mail transporter initialized');
    } catch (error) {
      this.initialized = false;
      Logging.error('Failed to initialize mail transporter', error);
    }
  }

  public async send(payload: TemplatePayload): Promise<void> {
    if (!this.initialized) this.initialize();
    if (!this.initialized) throw new Error('Mail transporter not initialized');

    const to = Array.isArray(payload.to) ? payload.to.join(',') : payload.to;
    const from = payload.from || mailConfig.from;

    const { html, text } = this.renderTemplate(payload.template, payload.templateData, payload.body);

    await this.transporter.sendMail({
      to,
      from,
      subject: payload.subject,
      html,
      text,
    });

    Logging.info('Email sent', { to, subject: payload.subject });
  }

  private renderTemplate(template?: string, data: any = {}, fallbackBody?: string): { html: string; text: string } {
    if (!template) {
      const text = fallbackBody || 'Notification';
      return { html: `<p>${text}</p>`, text };
    }

    switch (template) {
      case 'user_created': {
        const name = data?.name || 'User';
        const email = data?.email || '';
        const html = `
          <h2>Welcome, ${name}!</h2>
          <p>Your account (${email}) has been created successfully.</p>
        `;
        return { html, text: `Welcome, ${name}! Your account (${email}) has been created successfully.` };
      }
      case 'password_reset': {
        const method = data?.resetMethod || 'admin';
        const by = data?.resetBy || 'system';
        const html = `
          <h2>Password Reset</h2>
          <p>Your password has been reset via: <b>${method}</b>.</p>
          <p>Initiated by: ${by}</p>
        `;
        return { html, text: `Your password has been reset via: ${method}. Initiated by: ${by}` };
      }
      default: {
        const body = fallbackBody || 'Notification';
        return { html: `<p>${body}</p>`, text: body };
      }
    }
  }
}

export default MailService.getInstance();

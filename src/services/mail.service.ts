import nodemailer, { Transporter } from 'nodemailer';
import Logging from '../libraries/logging.library';
import { mailConfig, cookieConfig } from '../config';

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
        const tenantName = data?.tenantName || 'the platform';
        const baseDomain = cookieConfig.baseDomain || 'localhost:3000';
        const subdomain = data?.subdomain;
        
        // Debug logging to see what subdomain we're receiving
        Logging.info('MailService user_created template:', {
          subdomain,
          tenantName,
          baseDomain,
          email
        });
        
        // Construct URLs properly handling protocol
        let baseUrl, tenantLoginUrl;
        if (baseDomain.includes('://')) {
          // Base domain already has protocol (e.g., https://mypos.local)
          baseUrl = baseDomain;
          tenantLoginUrl = subdomain ? 
            baseDomain.replace('://', `://${subdomain}.`) : 
            baseDomain;
        } else {
          // Base domain without protocol (e.g., mypos.local)
          baseUrl = `http://${baseDomain}`;
          tenantLoginUrl = subdomain ? 
            `http://${subdomain}.${baseDomain}` : 
            `http://${baseDomain}`;
        }
        
        // Add /login path
        const loginUrl = data?.loginUrl || `${baseUrl}/login`;
        tenantLoginUrl = `${tenantLoginUrl}/login`;
        
        // Debug logging to see final URLs
        Logging.info('MailService URL construction:', {
          baseDomain,
          subdomain,
          baseUrl,
          loginUrl,
          tenantLoginUrl,
          finalUrlUsed: tenantLoginUrl
        });

        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333; text-align: center;">Welcome to ${tenantName}!</h2>
            <p>Hello <strong>${name}</strong>,</p>
            <p>Your account has been successfully created with the following details:</p>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Account Type:</strong> ${data?.role || 'User'}</p>
              ${subdomain ? `<p><strong>Organization:</strong> ${tenantName}</p>` : ''}
            </div>
            <p>You can now access your account using the login link below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${tenantLoginUrl}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Login to Your Account</a>
            </div>
            <p style="color: #666; font-size: 14px;">
              If the button doesn't work, you can copy and paste this link into your browser:<br>
              <a href="${tenantLoginUrl}">${tenantLoginUrl}</a>
            </p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #888; font-size: 12px; text-align: center;">
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        `;
        
        const text = `Welcome to ${tenantName}!\n\nHello ${name},\n\nYour account has been successfully created with the following details:\n\nEmail: ${email}\nAccount Type: ${data?.role || 'User'}\n${subdomain ? `Organization: ${tenantName}\n` : ''}\nYou can now access your account using this link: ${tenantLoginUrl}\n\nThis is an automated message. Please do not reply to this email.`;
        
        return { html, text };
      }
      
      case 'tenant_created': {
        const tenantName = data?.tenantName || 'Your Organization';
        const subdomain = data?.subdomain || '';
        const ownerName = data?.ownerName || 'Admin';
        const ownerEmail = data?.ownerEmail || '';
        const baseDomain = cookieConfig.baseDomain || 'localhost:3000';
        const protocol = baseDomain.includes('://') ? '' : 'http://';
        const loginUrl = subdomain ? 
          `${protocol}${subdomain}.${baseDomain}/login` : 
          `${protocol}${baseDomain}/login`;

        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333; text-align: center;">🎉 Welcome to Your New Organization!</h2>
            <p>Hello <strong>${ownerName}</strong>,</p>
            <p>Congratulations! Your organization "<strong>${tenantName}</strong>" has been successfully created and is ready to use.</p>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #007bff;">
              <h3 style="color: #333; margin-top: 0;">Organization Details:</h3>
              <p><strong>Organization Name:</strong> ${tenantName}</p>
              <p><strong>Subdomain:</strong> ${subdomain}</p>
              <p><strong>Admin Email:</strong> ${ownerEmail}</p>
              <p><strong>Your Login URL:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
            </div>

            <h3 style="color: #333;">What's Next?</h3>
            <ul style="line-height: 1.6;">
              <li>Access your organization dashboard using the login link below</li>
              <li>Set up your organization settings and preferences</li>
              <li>Invite team members to join your organization</li>
              <li>Start managing your point-of-sale operations</li>
            </ul>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginUrl}" style="background-color: #28a745; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Access Your Dashboard</a>
            </div>

            <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
              <p style="margin: 0; color: #856404;"><strong>Important:</strong> Please bookmark your organization's login URL for easy access: <a href="${loginUrl}">${loginUrl}</a></p>
            </div>

            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #888; font-size: 12px; text-align: center;">
              Need help getting started? Contact our support team.<br>
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        `;

        const text = `🎉 Welcome to Your New Organization!\n\nHello ${ownerName},\n\nCongratulations! Your organization "${tenantName}" has been successfully created and is ready to use.\n\nOrganization Details:\n- Organization Name: ${tenantName}\n- Subdomain: ${subdomain}\n- Admin Email: ${ownerEmail}\n- Your Login URL: ${loginUrl}\n\nWhat's Next?\n- Access your organization dashboard using the login link\n- Set up your organization settings and preferences\n- Invite team members to join your organization\n- Start managing your point-of-sale operations\n\nAccess your dashboard: ${loginUrl}\n\nImportant: Please bookmark your organization's login URL for easy access.\n\nNeed help getting started? Contact our support team.\nThis is an automated message. Please do not reply to this email.`;

        return { html, text };
      }

      case 'password_reset': {
        const method = data?.resetMethod || 'admin';
        const by = data?.resetBy || 'system';
        const name = data?.name || 'User';
        const baseDomain = cookieConfig.baseDomain || 'localhost:3000';
        const subdomain = data?.subdomain || '';
        // Construct URLs properly handling protocol
        let baseUrl, tenantLoginUrl;
        if (baseDomain.includes('://')) {
          // Base domain already has protocol (e.g., https://mypos.local)
          baseUrl = baseDomain;
          tenantLoginUrl = subdomain ? 
            baseDomain.replace('://', `://${subdomain}.`) : 
            baseDomain;
        } else {
          // Base domain without protocol (e.g., mypos.local)
          baseUrl = `http://${baseDomain}`;
          tenantLoginUrl = subdomain ? 
            `http://${subdomain}.${baseDomain}` : 
            `http://${baseDomain}`;
        }
        
        // Add /login path
        const loginUrl = data?.loginUrl || `${baseUrl}/login`;
        tenantLoginUrl = `${tenantLoginUrl}/login`;

        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333; text-align: center;">🔐 Password Reset Notification</h2>
            <p>Hello <strong>${name}</strong>,</p>
            <p>Your password has been successfully reset.</p>
            
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Reset Method:</strong> ${method}</p>
              <p><strong>Initiated By:</strong> ${by}</p>
              <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
            </div>

            <p>You can now login with your new password using the link below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${tenantLoginUrl}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Login Now</a>
            </div>

            <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
              <p style="margin: 0; color: #856404;"><strong>Security Note:</strong> If you did not request this password reset, please contact your administrator immediately.</p>
            </div>

            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #888; font-size: 12px; text-align: center;">
              This is an automated security notification. Please do not reply to this email.
            </p>
          </div>
        `;

        const text = `🔐 Password Reset Notification\n\nHello ${name},\n\nYour password has been successfully reset.\n\nReset Method: ${method}\nInitiated By: ${by}\nDate: ${new Date().toLocaleString()}\n\nYou can now login with your new password: ${loginUrl}\n\nSecurity Note: If you did not request this password reset, please contact your administrator immediately.\n\nThis is an automated security notification. Please do not reply to this email.`;

        return { html, text };
      }

      case 'welcome': {
        const name = data?.name || 'User';
        const isLandlord = data?.isLandlord || false;
        const baseDomain = cookieConfig.baseDomain || 'localhost:3000';
        const protocol = baseDomain.includes('://') ? '' : 'http://';
        const loginUrl = `${protocol}${baseDomain}/login`;

        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333; text-align: center;">🎉 Welcome to the Platform!</h2>
            <p>Hello <strong>${name}</strong>,</p>
            <p>Welcome to our Point of Sale management platform! Your account has been successfully registered.</p>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #007bff;">
              <h3 style="color: #333; margin-top: 0;">Account Information:</h3>
              <p><strong>Account Type:</strong> ${isLandlord ? 'Platform Administrator' : 'User'}</p>
              <p><strong>Status:</strong> Active</p>
            </div>

            ${isLandlord ? `
            <h3 style="color: #333;">As a Platform Administrator, you can:</h3>
            <ul style="line-height: 1.6;">
              <li>Create and manage multiple organizations</li>
              <li>Monitor platform-wide activities</li>
              <li>Manage user accounts across organizations</li>
              <li>Access administrative tools and reports</li>
            </ul>
            ` : `
            <h3 style="color: #333;">Getting Started:</h3>
            <ul style="line-height: 1.6;">
              <li>Complete your profile setup</li>
              <li>Explore the dashboard features</li>
              <li>Connect with your team members</li>
              <li>Start managing your operations</li>
            </ul>
            `}

            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginUrl}" style="background-color: #28a745; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Get Started</a>
            </div>

            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #888; font-size: 12px; text-align: center;">
              Need help? Contact our support team.<br>
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        `;

        const text = `🎉 Welcome to the Platform!\n\nHello ${name},\n\nWelcome to our Point of Sale management platform! Your account has been successfully registered.\n\nAccount Type: ${isLandlord ? 'Platform Administrator' : 'User'}\nStatus: Active\n\n${isLandlord ? 'As a Platform Administrator, you can create and manage multiple organizations, monitor platform-wide activities, and access administrative tools.' : 'Get started by completing your profile setup and exploring the dashboard features.'}\n\nLogin to get started: ${loginUrl}\n\nNeed help? Contact our support team.\nThis is an automated message. Please do not reply to this email.`;

        return { html, text };
      }

      default: {
        const body = fallbackBody || 'Notification';
        return { html: `<p>${body}</p>`, text: body };
      }
    }
  }
}

export default MailService.getInstance();

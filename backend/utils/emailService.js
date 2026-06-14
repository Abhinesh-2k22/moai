const nodemailer = require('nodemailer');

exports.sendOtpEmail = async (email, otp) => {
    const host = process.env.SMTP_HOST || 'smtp-relay.brevo.com';
    const port = parseInt(process.env.SMTP_PORT) || 587;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || user;

    if (user && pass) {
        try {
            let transporterConfig;
            if (process.env.SMTP_SERVICE === 'gmail' || (host && host.includes('gmail'))) {
                transporterConfig = {
                    service: 'gmail',
                    auth: {
                        user,
                        pass
                    },
                    tls: {
                        rejectUnauthorized: false
                    }
                };
            } else {
                transporterConfig = {
                    host,
                    port,
                    secure: port === 465, // true for 465, false for other ports
                    auth: {
                        user,
                        pass
                    },
                    tls: {
                        rejectUnauthorized: false
                    }
                };
            }

            const transporter = nodemailer.createTransport(transporterConfig);

            const mailOptions = {
                from: `"Moai Finance" <${from}>`,
                to: email,
                subject: 'Reset Your Password - Moai Finance OTP',
                html: `
                    <div style="font-family: sans-serif; padding: 24px; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
                        <div style="background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); padding: 16px; border-radius: 8px; text-align: center; color: white;">
                            <h2 style="margin: 0; font-size: 24px; font-weight: bold; letter-spacing: -0.025em;">Moai Finance</h2>
                        </div>
                        <div style="padding: 24px 0;">
                            <h3 style="margin-top: 0; color: #1e293b; font-size: 20px; font-weight: bold;">Password Reset OTP Request</h3>
                            <p style="color: #475569; font-size: 15px; line-height: 1.6;">You requested a password reset for your Moai Finance account. Use the 6-digit One-Time Password (OTP) below to reset your password. This OTP is valid for 10 minutes.</p>
                            
                            <div style="text-align: center; margin: 32px 0;">
                                <div style="display: inline-block; background-color: #f1f5f9; border: 2px dashed #6366f1; border-radius: 8px; padding: 12px 24px; font-size: 32px; font-weight: bold; color: #6366f1; letter-spacing: 0.1em;">
                                    ${otp}
                                </div>
                            </div>
                            
                            <p style="color: #ef4444; font-size: 13px; font-weight: 500;">If you did not request a password reset, please ignore this email or contact support if you suspect unauthorized access.</p>
                        </div>
                        <div style="border-top: 1px solid #f1f5f9; padding-top: 16px; text-align: center; color: #94a3b8; font-size: 12px;">
                            &copy; ${new Date().getFullYear()} Moai Finance. All rights reserved.
                        </div>
                    </div>
                `
            };

            const info = await transporter.sendMail(mailOptions);
            console.log(`[SMTP] OTP email successfully sent to ${email} (Message ID: ${info.messageId})`);
            return true;
        } catch (err) {
            console.error(`[SMTP ERROR] Failed to send OTP email: ${err.message}`);
            // Fallback to console log on error so execution doesn't block
        }
    }

    // Console Log Fallback (for local development or if SMTP fails / is not set)
    console.log('\n=============================================');
    console.log('            MOAI FINANCE OTP LOG             ');
    console.log('=============================================');
    console.log(`  Recipient:  ${email}`);
    console.log(`  OTP Code:   ${otp}  (Valid for 10 mins)`);
    console.log('=============================================\n');
    return true;
};

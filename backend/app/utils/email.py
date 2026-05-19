import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from datetime import datetime

from app.core.config import settings


def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: Optional[str] = None,
) -> bool:
    if not settings.SMTP_USERNAME or not settings.SMTP_PASSWORD:
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = (
            f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL or settings.SMTP_USERNAME}>"
        )
        msg["To"] = to_email
        msg["Subject"] = subject

        if text_content:
            msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.send_message(msg)

        return True
    except Exception:
        return False


def send_event_reminder(
    user_email: str,
    user_name: str,
    event_title: str,
    event_start: datetime,
    event_location: Optional[str] = None,
    event_online_link: Optional[str] = None,
) -> bool:
    start_str = event_start.strftime("%Y년 %m월 %d일 %H:%M")

    location_parts = []
    if event_location:
        location_parts.append(f"<p><strong>장소:</strong> {event_location}</p>")
    if event_online_link:
        location_parts.append(
            f'<p><strong>온라인:</strong> <a href="{event_online_link}">참여 링크</a></p>'
        )

    location_text = "".join(location_parts)

    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2563eb;">이벤트 리마인더</h2>
            <p>안녕하세요, {user_name}님!</p>
            <p>등록하신 이벤트가 곧 시작됩니다.</p>
            
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #1f2937;">{event_title}</h3>
                <p><strong>시작 시간:</strong> {start_str}</p>
                {location_text}
            </div>
            
            <p>잊지 말고 참석해 주세요!</p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="font-size: 12px; color: #6b7280;">
                이 이메일은 CodeIn 플랫폼에서 자동으로 발송되었습니다.
            </p>
        </div>
    </body>
    </html>
    """

    text_parts = [
        "이벤트 리마인더",
        "",
        f"안녕하세요, {user_name}님!",
        "",
        "등록하신 이벤트가 곧 시작됩니다.",
        "",
        f"이벤트: {event_title}",
        f"시작 시간: {start_str}",
    ]

    if event_location:
        text_parts.append(f"장소: {event_location}")
    if event_online_link:
        text_parts.append(f"온라인 링크: {event_online_link}")

    text_parts.extend(["", "잊지 말고 참석해 주세요!"])
    text_content = "\n".join(text_parts)

    return send_email(
        to_email=user_email,
        subject=f"[CodeIn] 이벤트 리마인더: {event_title}",
        html_content=html_content,
        text_content=text_content,
    )

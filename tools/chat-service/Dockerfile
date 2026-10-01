FROM python:3.13-alpine
WORKDIR /app
COPY chat.py .
RUN mkdir /data && chown nobody /data
ENV DATABASE=/data/chat.db PORT=8090
VOLUME /data
EXPOSE 8090
USER nobody
CMD ["python", "-u", "chat.py"]

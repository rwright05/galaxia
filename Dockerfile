# Use a lightweight Nginx image
FROM nginx:alpine

# Copy the custom Nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy the static game files into the container
COPY src/ /usr/share/nginx/html

# Create the directory for Nginx logs
RUN mkdir -p /var/log/galaxia

# Expose port 80 (mapped from host port 5023 in docker-compose.yml)
EXPOSE 80

FROM php:8.4-cli-alpine

# System dependencies
RUN apk add --no-cache \
    git \
    curl \
    zip \
    unzip \
    linux-headers \
    $PHPIZE_DEPS

# PHP extensions
RUN docker-php-ext-install pdo pdo_mysql pcntl bcmath

# Redis extension
RUN pecl install redis && docker-php-ext-enable redis

# Xdebug
RUN pecl install xdebug && docker-php-ext-enable xdebug

# Xdebug config
RUN echo "xdebug.mode=develop,debug" >> /usr/local/etc/php/conf.d/docker-php-ext-xdebug.ini \
 && echo "xdebug.start_with_request=yes" >> /usr/local/etc/php/conf.d/docker-php-ext-xdebug.ini \
 && echo "xdebug.client_host=host.docker.internal" >> /usr/local/etc/php/conf.d/docker-php-ext-xdebug.ini \
 && echo "xdebug.client_port=9003" >> /usr/local/etc/php/conf.d/docker-php-ext-xdebug.ini

# Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

EXPOSE 8000
EXPOSE 9003

#CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000"]

#!/bin/bash

QUERY="$@"
mpv --no-video "$(./cli.js $QUERY)"

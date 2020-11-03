#!/bin/bash

QUERY="$@"
mpv "$(./cli.js $QUERY)"

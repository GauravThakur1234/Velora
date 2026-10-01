import React from 'react';
import { Redirect } from 'expo-router';

export default function IndexScreen() {
  // Immediately redirects the user to the authentication page without rendering any UI
  return <Redirect href="/(auth)/authentication" />;
}
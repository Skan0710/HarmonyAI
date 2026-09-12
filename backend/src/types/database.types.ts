export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      album_featured_artists: {
        Row: {
          album_id: string
          artist_id: string
        }
        Insert: {
          album_id: string
          artist_id: string
        }
        Update: {
          album_id?: string
          artist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "album_featured_artists_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "album_featured_artists_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      albums: {
        Row: {
          album_type: string | null
          artist_id: string
          cover_image: string | null
          created_at: string | null
          genre_id: string | null
          id: string
          release_date: string | null
          release_year: number | null
          tags: string[] | null
          title: string
          total_tracks: number | null
          updated_at: string | null
        }
        Insert: {
          album_type?: string | null
          artist_id: string
          cover_image?: string | null
          created_at?: string | null
          genre_id?: string | null
          id?: string
          release_date?: string | null
          release_year?: number | null
          tags?: string[] | null
          title: string
          total_tracks?: number | null
          updated_at?: string | null
        }
        Update: {
          album_type?: string | null
          artist_id?: string
          cover_image?: string | null
          created_at?: string | null
          genre_id?: string | null
          id?: string
          release_date?: string | null
          release_year?: number | null
          tags?: string[] | null
          title?: string
          total_tracks?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "albums_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "albums_genre_id_fkey"
            columns: ["genre_id"]
            isOneToOne: false
            referencedRelation: "genres"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_genres: {
        Row: {
          artist_id: string
          genre_id: string
        }
        Insert: {
          artist_id: string
          genre_id: string
        }
        Update: {
          artist_id?: string
          genre_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "artist_genres_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artist_genres_genre_id_fkey"
            columns: ["genre_id"]
            isOneToOne: false
            referencedRelation: "genres"
            referencedColumns: ["id"]
          },
        ]
      }
      artists: {
        Row: {
          avatar: string | null
          banner_image: string | null
          bio: string | null
          created_at: string | null
          id: string
          monthly_listeners: number | null
          name: string
          profile_image: string | null
          recommendation_metadata: Json | null
          similar_artists: string[] | null
          social_links: Json | null
          tags: string[] | null
          updated_at: string | null
          vector_embedding: string | null
          verified: boolean | null
        }
        Insert: {
          avatar?: string | null
          banner_image?: string | null
          bio?: string | null
          created_at?: string | null
          id?: string
          monthly_listeners?: number | null
          name: string
          profile_image?: string | null
          recommendation_metadata?: Json | null
          similar_artists?: string[] | null
          social_links?: Json | null
          tags?: string[] | null
          updated_at?: string | null
          vector_embedding?: string | null
          verified?: boolean | null
        }
        Update: {
          avatar?: string | null
          banner_image?: string | null
          bio?: string | null
          created_at?: string | null
          id?: string
          monthly_listeners?: number | null
          name?: string
          profile_image?: string | null
          recommendation_metadata?: Json | null
          similar_artists?: string[] | null
          social_links?: Json | null
          tags?: string[] | null
          updated_at?: string | null
          vector_embedding?: string | null
          verified?: boolean | null
        }
        Relationships: []
      }
      genres: {
        Row: {
          cover_image: string | null
          created_at: string | null
          description: string | null
          id: string
          is_featured: boolean | null
          name: string
          parent_genre_id: string | null
          slug: string
          tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          cover_image?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_featured?: boolean | null
          name: string
          parent_genre_id?: string | null
          slug: string
          tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          cover_image?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_featured?: boolean | null
          name?: string
          parent_genre_id?: string | null
          slug?: string
          tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "genres_parent_genre_id_fkey"
            columns: ["parent_genre_id"]
            isOneToOne: false
            referencedRelation: "genres"
            referencedColumns: ["id"]
          },
        ]
      }
      listening_history: {
        Row: {
          completed: boolean | null
          created_at: string | null
          id: string
          played_at: string | null
          progress_percent: number | null
          skipped: boolean | null
          song_id: string
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          created_at?: string | null
          id?: string
          played_at?: string | null
          progress_percent?: number | null
          skipped?: boolean | null
          song_id: string
          user_id: string
        }
        Update: {
          completed?: boolean | null
          created_at?: string | null
          id?: string
          played_at?: string | null
          progress_percent?: number | null
          skipped?: boolean | null
          song_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listening_history_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listening_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      listening_sessions: {
        Row: {
          created_at: string | null
          device_context: Json | null
          id: string
          initial_intent: string | null
          current_song: string | null
          last_activity_time: string
          metadata: Json
          session_context: Json
          session_dynamics: Json | null
          session_end: string | null
          session_events: Json
          session_start: string | null
          status: string
          tracks_completed: Json
          tracks_played: Json | null
          tracks_skipped: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_context?: Json | null
          id?: string
          initial_intent?: string | null
          current_song?: string | null
          last_activity_time?: string
          metadata?: Json
          session_context?: Json
          session_dynamics?: Json | null
          session_end?: string | null
          session_events?: Json
          session_start?: string | null
          status?: string
          tracks_completed?: Json
          tracks_played?: Json | null
          tracks_skipped?: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_context?: Json | null
          id?: string
          initial_intent?: string | null
          current_song?: string | null
          last_activity_time?: string
          metadata?: Json
          session_context?: Json
          session_dynamics?: Json | null
          session_end?: string | null
          session_events?: Json
          session_start?: string | null
          status?: string
          tracks_completed?: Json
          tracks_played?: Json | null
          tracks_skipped?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listening_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      music_dna: {
        Row: {
          artists: Json | null
          created_at: string | null
          genres: Json | null
          id: string
          last_calculated_at: string | null
          listening_patterns: Json | null
          metadata: Json
          moods: Json | null
          temporal_taste: Json | null
          tendencies: Json | null
          updated_at: string | null
          user_id: string
          version: number | null
        }
        Insert: {
          artists?: Json | null
          created_at?: string | null
          genres?: Json | null
          id?: string
          last_calculated_at?: string | null
          listening_patterns?: Json | null
          metadata?: Json
          moods?: Json | null
          temporal_taste?: Json | null
          tendencies?: Json | null
          updated_at?: string | null
          user_id: string
          version?: number | null
        }
        Update: {
          artists?: Json | null
          created_at?: string | null
          genres?: Json | null
          id?: string
          last_calculated_at?: string | null
          listening_patterns?: Json | null
          metadata?: Json
          moods?: Json | null
          temporal_taste?: Json | null
          tendencies?: Json | null
          updated_at?: string | null
          user_id?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "music_dna_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      music_dna_snapshots: {
        Row: {
          artists: Json | null
          created_at: string | null
          genres: Json | null
          id: string
          listening_patterns: Json | null
          moods: Json | null
          snapshot_date: string | null
          tendencies: Json | null
          user_id: string
        }
        Insert: {
          artists?: Json | null
          created_at?: string | null
          genres?: Json | null
          id?: string
          listening_patterns?: Json | null
          moods?: Json | null
          snapshot_date?: string | null
          tendencies?: Json | null
          user_id: string
        }
        Update: {
          artists?: Json | null
          created_at?: string | null
          genres?: Json | null
          id?: string
          listening_patterns?: Json | null
          moods?: Json | null
          snapshot_date?: string | null
          tendencies?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "music_dna_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_music_twin: {
        Row: {
          compatibility_dimensions: Json | null
          created_at: string | null
          emerging_interests: Json | null
          genre_identity: Json | null
          id: string
          last_sync_at: string | null
          listening_behavior: Json | null
          metadata: Json
          mood_identity: Json | null
          musical_traits: Json | null
          personality_profile: Json | null
          taste_evolution: Json | null
          taste_stability: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          compatibility_dimensions?: Json | null
          created_at?: string | null
          emerging_interests?: Json | null
          genre_identity?: Json | null
          id?: string
          last_sync_at?: string | null
          listening_behavior?: Json | null
          metadata?: Json
          mood_identity?: Json | null
          musical_traits?: Json | null
          personality_profile?: Json | null
          taste_evolution?: Json | null
          taste_stability?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          compatibility_dimensions?: Json | null
          created_at?: string | null
          emerging_interests?: Json | null
          genre_identity?: Json | null
          id?: string
          last_sync_at?: string | null
          listening_behavior?: Json | null
          metadata?: Json
          mood_identity?: Json | null
          musical_traits?: Json | null
          personality_profile?: Json | null
          taste_evolution?: Json | null
          taste_stability?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_music_twin_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      playlist_collaborators: {
        Row: {
          playlist_id: string
          user_id: string
        }
        Insert: {
          playlist_id: string
          user_id: string
        }
        Update: {
          playlist_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_collaborators_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_collaborators_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      playlist_songs: {
        Row: {
          added_at: string | null
          playlist_id: string
          position: number | null
          song_id: string
        }
        Insert: {
          added_at?: string | null
          playlist_id: string
          position?: number | null
          song_id: string
        }
        Update: {
          added_at?: string | null
          playlist_id?: string
          position?: number | null
          song_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_songs_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_songs_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          cover_image: string | null
          created_at: string | null
          description: string | null
          id: string
          is_collaborative: boolean | null
          name: string
          owner_id: string
          updated_at: string | null
          visibility: string | null
        }
        Insert: {
          cover_image?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_collaborative?: boolean | null
          name: string
          owner_id: string
          updated_at?: string | null
          visibility?: string | null
        }
        Update: {
          cover_image?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_collaborative?: boolean | null
          name?: string
          owner_id?: string
          updated_at?: string | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "playlists_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendation_contexts: {
        Row: {
          active_context: Json | null
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          active_context?: Json | null
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          active_context?: Json | null
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_contexts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendation_evaluations: {
        Row: {
          created_at: string | null
          evaluated_at: string | null
          id: string
          metrics: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          evaluated_at?: string | null
          id?: string
          metrics?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          evaluated_at?: string | null
          id?: string
          metrics?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_evaluations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendation_interactions: {
        Row: {
          action: string
          created_at: string | null
          id: string
          metadata: Json | null
          position: number | null
          recommendation_id: string | null
          song_id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          position?: number | null
          recommendation_id?: string | null
          song_id: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          position?: number | null
          recommendation_id?: string | null
          song_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_interactions_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendation_interactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      song_featured_artists: {
        Row: {
          artist_id: string
          song_id: string
        }
        Insert: {
          artist_id: string
          song_id: string
        }
        Update: {
          artist_id?: string
          song_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "song_featured_artists_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "song_featured_artists_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      songs: {
        Row: {
          album_id: string | null
          artist_id: string
          audio_features: Json | null
          audio_url: string
          cover_image: string | null
          created_at: string | null
          duration: number
          embedding_dimension: number | null
          embedding_generated_at: string | null
          embedding_provider: string | null
          explicit: boolean | null
          genre_id: string
          id: string
          is_published: boolean | null
          language: string | null
          lyrics: string | null
          mood: string | null
          play_count: number | null
          recommendation_metadata: Json | null
          release_year: number | null
          tags: string[] | null
          title: string
          updated_at: string | null
          vector_embedding: string | null
          youtube_video_id: string | null
        }
        Insert: {
          album_id?: string | null
          artist_id: string
          audio_features?: Json | null
          audio_url: string
          cover_image?: string | null
          created_at?: string | null
          duration: number
          embedding_dimension?: number | null
          embedding_generated_at?: string | null
          embedding_provider?: string | null
          explicit?: boolean | null
          genre_id: string
          id?: string
          is_published?: boolean | null
          language?: string | null
          lyrics?: string | null
          mood?: string | null
          play_count?: number | null
          recommendation_metadata?: Json | null
          release_year?: number | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
          vector_embedding?: string | null
          youtube_video_id?: string | null
        }
        Update: {
          album_id?: string | null
          artist_id?: string
          audio_features?: Json | null
          audio_url?: string
          cover_image?: string | null
          created_at?: string | null
          duration?: number
          embedding_dimension?: number | null
          embedding_generated_at?: string | null
          embedding_provider?: string | null
          explicit?: boolean | null
          genre_id?: string
          id?: string
          is_published?: boolean | null
          language?: string | null
          lyrics?: string | null
          mood?: string | null
          play_count?: number | null
          recommendation_metadata?: Json | null
          release_year?: number | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          vector_embedding?: string | null
          youtube_video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "songs_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "songs_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "songs_genre_id_fkey"
            columns: ["genre_id"]
            isOneToOne: false
            referencedRelation: "genres"
            referencedColumns: ["id"]
          },
        ]
      }
      temporal_preferences: {
        Row: {
          audio_feature_targets: Json | null
          created_at: string | null
          day_type: string
          id: string
          preferred_genres: Json | null
          preferred_moods: Json | null
          time_slot: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          audio_feature_targets?: Json | null
          created_at?: string | null
          day_type: string
          id?: string
          preferred_genres?: Json | null
          preferred_moods?: Json | null
          time_slot: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          audio_feature_targets?: Json | null
          created_at?: string | null
          day_type?: string
          id?: string
          preferred_genres?: Json | null
          preferred_moods?: Json | null
          time_slot?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "temporal_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_favorite_artists: {
        Row: {
          artist_id: string
          created_at: string | null
          user_id: string
        }
        Insert: {
          artist_id: string
          created_at?: string | null
          user_id: string
        }
        Update: {
          artist_id?: string
          created_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_favorite_artists_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_favorite_artists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_favorite_genres: {
        Row: {
          created_at: string | null
          genre_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          genre_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          genre_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_favorite_genres_genre_id_fkey"
            columns: ["genre_id"]
            isOneToOne: false
            referencedRelation: "genres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_favorite_genres_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_liked_songs: {
        Row: {
          created_at: string | null
          song_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          song_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          song_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_liked_songs_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_liked_songs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          clerk_id: string | null
          created_at: string | null
          email: string
          id: string
          name: string
          password_hash: string | null
          profile_picture: string | null
          role: string
          updated_at: string | null
        }
        Insert: {
          clerk_id?: string | null
          created_at?: string | null
          email: string
          id?: string
          name: string
          password_hash?: string | null
          profile_picture?: string | null
          role?: string
          updated_at?: string | null
        }
        Update: {
          clerk_id?: string | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          password_hash?: string | null
          profile_picture?: string | null
          role?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

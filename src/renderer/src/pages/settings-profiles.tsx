import { Button } from "@renderer/components/ui/button"
import { ControlGroup } from "@renderer/components/ui/control"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@renderer/components/ui/dialog"
import { Input } from "@renderer/components/ui/input"
import { Textarea } from "@renderer/components/ui/textarea"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@renderer/components/ui/tooltip"
import { queryClient } from "@renderer/lib/query-client"
import { tipcClient } from "@renderer/lib/tipc-client"
import { cn } from "@renderer/lib/utils"
import { SettingsProfile } from "@shared/types"
import { useMutation, useQuery } from "@tanstack/react-query"
import dayjs from "dayjs"
import { useState } from "react"

export function Component() {
  const [editingProfile, setEditingProfile] = useState<SettingsProfile | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newProfileName, setNewProfileName] = useState("")
  const [newProfileDescription, setNewProfileDescription] = useState("")

  // Queries
  const profilesQuery = useQuery({
    queryKey: ["profiles"],
    queryFn: () => tipcClient.getProfiles(),
  })

  const activeProfileIdQuery = useQuery({
    queryKey: ["activeProfileId"],
    queryFn: () => tipcClient.getActiveProfileId(),
  })

  // Mutations
  const createProfileMutation = useMutation({
    mutationFn: tipcClient.createProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] })
      setIsCreateDialogOpen(false)
      setNewProfileName("")
      setNewProfileDescription("")
    },
  })

  const updateProfileMutation = useMutation({
    mutationFn: tipcClient.updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] })
      setEditingProfile(null)
    },
  })

  const deleteProfileMutation = useMutation({
    mutationFn: tipcClient.deleteProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] })
      queryClient.invalidateQueries({ queryKey: ["activeProfileId"] })
    },
  })

  const switchProfileMutation = useMutation({
    mutationFn: tipcClient.switchProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeProfileId"] })
      queryClient.invalidateQueries({ queryKey: ["config"] })
    },
  })

  const duplicateProfileMutation = useMutation({
    mutationFn: tipcClient.duplicateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] })
    },
  })

  const profiles = profilesQuery.data || []
  const activeProfileId = activeProfileIdQuery.data

  const handleCreateProfile = () => {
    if (!newProfileName.trim()) return

    createProfileMutation.mutate({
      name: newProfileName,
      description: newProfileDescription || undefined,
    })
  }

  const handleDeleteProfile = (profile: SettingsProfile) => {
    if (profile.isDefault) {
      alert("Cannot delete the default profile")
      return
    }

    if (window.confirm(`Delete profile "${profile.name}"?`)) {
      deleteProfileMutation.mutate({ profileId: profile.id })
    }
  }

  const handleDuplicateProfile = (profile: SettingsProfile) => {
    const newName = window.prompt(`Duplicate "${profile.name}" as:`, `${profile.name} (Copy)`)
    if (newName) {
      duplicateProfileMutation.mutate({
        profileId: profile.id,
        newName,
      })
    }
  }

  const handleSwitchProfile = (profileId: string) => {
    switchProfileMutation.mutate({ profileId })
  }

  return (
    <div className="grid gap-4">
      <ControlGroup
        title="Settings Profiles"
        endDescription={
          <Button
            size="sm"
            variant="outline"
            className="h-6 gap-1 px-2"
            onClick={() => setIsCreateDialogOpen(true)}
          >
            <span className="i-mingcute-add-line"></span>
            New Profile
          </Button>
        }
      >
        {profiles.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            No profiles found
          </div>
        ) : (
          profiles.map((profile) => (
            <div
              key={profile.id}
              className={cn(
                "flex items-center justify-between gap-3 px-3 py-3 transition-colors",
                activeProfileId === profile.id && "bg-neutral-50 dark:bg-neutral-900"
              )}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <input
                  type="radio"
                  name="profile"
                  checked={activeProfileId === profile.id}
                  onChange={() => handleSwitchProfile(profile.id)}
                  className="cursor-pointer"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">
                    {profile.name}
                    {profile.isDefault && (
                      <span className="ml-2 text-xs text-muted-foreground">(Default)</span>
                    )}
                  </div>
                  {profile.description && (
                    <div className="text-xs text-muted-foreground truncate">
                      {profile.description}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    Last updated {dayjs(profile.updatedAt).fromNow()}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setEditingProfile(profile)}
                      >
                        <span className="i-mingcute-edit-2-line text-sm"></span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit profile</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleDuplicateProfile(profile)}
                      >
                        <span className="i-mingcute-copy-2-line text-sm"></span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Duplicate profile</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {!profile.isDefault && (
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500 hover:text-red-600"
                          onClick={() => handleDeleteProfile(profile)}
                        >
                          <span className="i-mingcute-delete-2-line text-sm"></span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete profile</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
          ))
        )}
      </ControlGroup>

      <ControlGroup title="Profile Management Tips">
        <div className="px-3 text-sm text-gray-600 dark:text-gray-400 space-y-2">
          <p>
            <strong>📁 Organize:</strong> Create different profiles for different use cases - work, personal, different languages, etc.
          </p>
          <p>
            <strong>🔄 Switch:</strong> Click on any profile to switch to it instantly. All settings will be updated immediately.
          </p>
          <p>
            <strong>📝 Copy:</strong> Duplicate an existing profile to create variations without starting from scratch.
          </p>
          <p>
            <strong>🔒 Default:</strong> The default profile cannot be deleted but can be edited to suit your needs.
          </p>
        </div>
      </ControlGroup>

      {/* Create Profile Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Profile</DialogTitle>
            <DialogDescription>
              Create a new settings profile based on your current configuration
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Profile Name *</label>
              <Input
                placeholder="e.g., Work, Personal, Meeting Notes"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newProfileName.trim()) {
                    handleCreateProfile()
                  }
                }}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Description (Optional)</label>
              <Textarea
                rows={3}
                placeholder="Describe when to use this profile..."
                value={newProfileDescription}
                onChange={(e) => setNewProfileDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateProfile}
              disabled={!newProfileName.trim() || createProfileMutation.isPending}
            >
              Create Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Profile Dialog */}
      {editingProfile && (
        <Dialog open={!!editingProfile} onOpenChange={() => setEditingProfile(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Profile</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Profile Name</label>
                <Input
                  value={editingProfile.name}
                  onChange={(e) => setEditingProfile({
                    ...editingProfile,
                    name: e.target.value
                  })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Description</label>
                <Textarea
                  rows={3}
                  value={editingProfile.description || ""}
                  onChange={(e) => setEditingProfile({
                    ...editingProfile,
                    description: e.target.value
                  })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingProfile(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  updateProfileMutation.mutate({
                    profileId: editingProfile.id,
                    updates: {
                      name: editingProfile.name,
                      description: editingProfile.description,
                    }
                  })
                }}
                disabled={!editingProfile.name.trim() || updateProfileMutation.isPending}
              >
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

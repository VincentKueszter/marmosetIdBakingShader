# Improved Marmoset Id BakingShader
An improvement to the default Marmoset Toolbag ID baking shader.
I noticed that the colors which are generated by Marmoset are suboptimal.
I created a model with 25 different materials to test this and the resulting colors should only have the channel values 255, 128 and 0, in some combination.
Yet, with the default ID baking shader, there are colors that only differ by 33 in one channel: (0,74,255) and (0,107,255).
The Marmoset tutorial states: "The color is automatically applied, and the colors are picked so that they are as different as possible from the other colors."
This does not seem to be the case. (I am aware the difference in HSV might be larger than in RGB, but still, the colors are too close.)

I implemented a fix by modifying the baking shader, which you can find here.
It will generate colors that are as different as possible to each other, at least according to their channel intensity values.
(Since ColorID maps are not supposed to be viewed by humans, I don’t think it’s necessary to make the colors as different as possible to the human eye.)

# Installation
- Navigate to where Toolbag is installed, then to data\shader\bake
- make a backup of bakeIDs.frag
- depending on your Toolbag version, copy bakeIDs.frag from the v3 or the v4 folder into data\shader\bake, overwriting the old bakeIDs.frag
- start Marmoset Toolbag

It should now bake with the improved Id BakingShader. To make sure everything works correctly now:
- navigate to Help->Dev->Console...
- click "Show only Errors"
- click Help->Dev->Reload Shaders
- if there are errors there or when baking: Please inform me!

# Explanation
To get colors that are different from each other, we have to generate RGB patterns that have the maximal distance from each other.
This does not mean they have to be visually different, since humans perceive colors a bit differently, but different in their RGB values.
We assume the material, object and group IDs starts at zero. Every ID x that appears means that there have to be at least x colors.
We can define a sequence of colors that starts with the maximal distance (black/white), then contains the primary colors, the mixtures between the primary colors, then the mixtures between the mixtures, and so on.
If we index this sequence with the material/object/group ID, the low IDs get colors that are very different form each other and with rising ID, the colors get more and more similar.
This algorithm, given an ID, creates the color that would appear in this sequence at that index.

Each color has three channels. The channels contain the values of red, blue and green.
We can generate many different colors with only a small set of different channel values, which are used in many different combinations.
For example, our color sequence starts with:
(255,255,255),
(0,0,0),
(255,0,0),
(0,255,0),
(0,0,255),
(255,255,0),
(0,255,255),
(255,0,255).
These are 8 colors, consisting of 2 different channel values in different combinations.
We start with one value, 255, to create one possible color, white (255,255,255).
Then we have to add a second value, 0. We now can list all f(n)=3*n^2+3*n+1 new variants of combining 0 and 255, thus enabling us to list f(0)+f(1)=1+7=8 colors.
If we want to represent a ninth color, we need a third value.
This value lies between 255 and 0, so 128. Having a third value results in f(2)=19 new combinations, for a total of 27 possible colors.
The next values after 128 have to lie between the existing ones, so we have 64, 192, 32, 160, 96 and so on.
Let's call this sequence the "sequence of intensities".
The number of intensity values we need to generate enough colors for a given ID is the cube root of the ID.

The algorithm now consists of two main steps.
First, we generate a pattern that determines which intensities we have to use and returns indices on the sequence of intensities.
Second, we determine the actual value for each of the three indices in the pattern and normalize it to [0.0,1.0].